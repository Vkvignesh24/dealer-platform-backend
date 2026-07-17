const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Reservation = require('../models/Reservation');
const Lead = require('../models/Lead');
const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { logAction } = require('../services/auditService');

const POPULATE_PRODUCT = { path: 'product', select: 'name brand category price images status' };
const POPULATE_CUSTOMER = { path: 'customer', select: 'name email phone' };

/**
 * Resolves the customer a sale/reservation is being recorded for.
 * - existing: customerId must reference a real user.
 * - walk_in: creates (or reuses, by phone) a lightweight customer record.
 *   Walk-in customers never touched the app, so they have no firebaseUid.
 */
async function resolveCustomer({ customerType, customerId, walkIn }) {
  if (customerType === 'walk_in') {
    if (!walkIn || !walkIn.name || !walkIn.phone) {
      const err = new Error('Walk-in customer requires a name and phone number');
      err.status = 400;
      throw err;
    }
    let customer = await User.findOne({ phone: walkIn.phone, role: 'customer' });
    if (!customer) {
      customer = await User.create({
        name: walkIn.name,
        phone: walkIn.phone,
        email: walkIn.email || `walkin-${walkIn.phone}@no-email.local`,
        role: 'customer',
      });
    }
    return customer;
  }
  if (!customerId) {
    const err = new Error('customerId is required for an existing customer sale');
    err.status = 400;
    throw err;
  }
  const customer = await User.findById(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.status = 404;
    throw err;
  }
  return customer;
}

/**
 * POST /sales — "Mark As Sold"
 * The ONLY way a product's status is allowed to become `sold`. Creates a
 * NEW sale record (a product may carry many over its lifetime — sold,
 * reversed, sold again — but only one may ever be `active`) and cascades
 * every dependent update (product, lead, loan, reservation, customer
 * purchase history) together.
 */
exports.create = asyncHandler(async (req, res) => {
  const {
    productId,
    customerType = 'existing',
    customerId,
    walkIn, // { name, phone, email }
    leadId,
    loanId,
    salePrice,
    discount = 0,
    bookingAmount = 0,
    paymentMethod = 'cash',
    loanUsed = false,
    remarks,
    soldDate,
  } = req.body;

  if (!productId) return fail(res, 'productId is required', 400);
  if (salePrice === undefined || salePrice === null || Number(salePrice) < 0) {
    return fail(res, 'A valid salePrice is required', 400);
  }

  const product = await Product.findById(productId);
  if (!product) return fail(res, 'Product not found', 404);
  if (product.status === 'sold') return fail(res, 'This product is already marked as sold', 409);
  if (product.status === 'archived') return fail(res, 'Cannot sell an archived product', 409);

  // Defense in depth — the partial unique index on Sale also guarantees
  // this, but checking here lets us return a clean 409 instead of a raw
  // MongoServerError(11000) bubbling up from the driver.
  const existingActiveSale = await Sale.findOne({ product: product._id, status: 'active' });
  if (existingActiveSale) return fail(res, 'This product already has an active sale', 409);

  const customer = await resolveCustomer({ customerType, customerId, walkIn });

  let lead = null;
  if (leadId) {
    lead = await Lead.findById(leadId);
    if (!lead) return fail(res, 'Lead not found', 404);
  }

  let loan = null;
  if (loanId) {
    loan = await LoanRequest.findById(loanId);
    if (!loan) return fail(res, 'Loan request not found', 404);
  }

  // If the product currently carries an active reservation, this sale
  // completes it rather than leaving it dangling.
  const activeReservation = await Reservation.findOne({ product: product._id, status: 'active' });

  const sale = await Sale.create({
    product: product._id,
    customer: customer._id,
    customerType,
    lead: lead ? lead._id : null,
    loan: loan ? loan._id : null,
    reservation: activeReservation ? activeReservation._id : null,
    previousLeadStatus: lead ? lead.status : null,
    previousLoanStatus: loan ? loan.status : null,
    salePrice: Number(salePrice),
    discount: Number(discount) || 0,
    bookingAmount: Number(bookingAmount) || (activeReservation ? activeReservation.bookingAmount : 0),
    paymentMethod,
    loanUsed: Boolean(loanUsed) || Boolean(loan),
    remarks,
    soldDate: soldDate ? new Date(soldDate) : new Date(),
    soldBy: req.user._id,
    status: 'active',
  });

  // Product -> sold (this is the single legitimate path to that status)
  product.status = 'sold';
  product.activeSale = sale._id;
  product.activeReservation = null;
  product.statusHistory.push({ status: 'sold', note: `Sold to ${customer.name}`, by: req.user._id });
  await product.save();

  // Reservation -> completed
  if (activeReservation) {
    activeReservation.status = 'completed';
    activeReservation.releasedAt = new Date();
    await activeReservation.save();
  }

  // Lead -> sold, with conversion metadata for reverse-sync
  if (lead) {
    lead.history.push({ status: 'sold', note: 'Converted to sale' });
    lead.status = 'sold';
    lead.saleId = sale._id;
    lead.converted = true;
    lead.convertedAt = new Date();
    await lead.save();
  }

  // Loan -> disbursed (only meaningful when the sale actually used a loan)
  if (loan && (Boolean(loanUsed) || paymentMethod === 'loan' || paymentMethod === 'mixed')) {
    if (!Array.isArray(loan.statusHistory)) loan.statusHistory = [];
    loan.statusHistory.push({ status: 'disbursed', note: 'Loan disbursed on sale', by: req.user._id });
    loan.status = 'disbursed';
    loan.saleId = sale._id;
    await loan.save();
  }

  // Customer purchase history — a new active entry. If this customer had
  // a previously cancelled entry for the same product (bought it, sale
  // reversed, bought it again), that old entry is left as-is (history is
  // never erased) and this new one is appended alongside it.
  await User.findByIdAndUpdate(customer._id, {
    $push: {
      purchaseHistory: {
        product: product._id,
        sale: sale._id,
        salePrice: sale.salePrice,
        soldDate: sale.soldDate,
        status: 'active',
      },
    },
  });

  const populated = await Sale.findById(sale._id).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).lean();

  notify({
    audience: 'dealer',
    type: 'sale_created',
    title: 'Product Sold Successfully',
    body: `${product.name} sold to ${customer.name}`,
    entityType: 'sale',
    entityId: sale._id,
    createdBy: req.user._id,
  });
  logAction({ action: 'sale_created', entityType: 'sale', entityId: sale._id, entityLabel: `${product.name} → ${customer.name}`, user: req.user });

  ok(res, populated, 'Sale recorded', 201);
});

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, product, status } = req.query;
  const q = {};
  if (product) q.product = product;
  if (status) q.status = status;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const [items, total] = await Promise.all([
    Sale.find(q).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).sort('-soldDate').skip((p - 1) * l).limit(l).lean(),
    Sale.countDocuments(q),
  ]);
  ok(res, { items, total, page: p, pages: Math.ceil(total / l) || 1 }, 'Sales');
});

exports.get = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).lean();
  if (!sale) return fail(res, 'Sale not found', 404);
  ok(res, sale, 'Sale');
});

// Customer-facing: purchase history with full sale detail. Only ACTIVE
// purchases are shown here — once a sale is reversed the customer no
// longer owns the vehicle, even though the record itself is preserved
// for the dealer's audit trail (see admin customer detail / GET /sales).
exports.mine = asyncHandler(async (req, res) => {
  const items = await Sale.find({ customer: req.user._id, status: 'active' })
    .populate(POPULATE_PRODUCT)
    .sort('-soldDate')
    .lean();
  ok(res, items, 'My purchases');
});

const REASON_LABELS = {
  customer_cancelled: 'Customer Cancelled',
  loan_rejected: 'Loan Rejected',
  wrong_entry: 'Wrong Entry',
  duplicate_entry: 'Duplicate Entry',
  other: 'Other',
};

/**
 * PATCH /sales/:id/reverse — "Reverse Sale"
 * Never deletes the sale. Marks it reversed with a reason, reopens the
 * product, and restores every linked record (lead, loan, reservation,
 * customer purchase entry) to its pre-sale state.
 */
exports.reverse = asyncHandler(async (req, res) => {
  const { reason, note } = req.body || {};
  if (!reason || !Sale.REVERSE_REASONS.includes(reason)) {
    return fail(res, `reason must be one of: ${Sale.REVERSE_REASONS.join(', ')}`, 400);
  }

  const sale = await Sale.findById(req.params.id);
  if (!sale) return fail(res, 'Sale not found', 404);
  if (sale.status !== 'active') return fail(res, 'Only an active sale can be reversed', 409);

  sale.status = 'reversed';
  sale.reverseReason = reason;
  sale.reverseNote = note;
  sale.reversedAt = new Date();
  sale.reversedBy = req.user._id;
  await sale.save();

  // Product -> available (only if it's still pointing at this sale; a
  // later sale on the same product should never be clobbered by an old
  // reversal request arriving out of order).
  const product = await Product.findById(sale.product);
  if (product && String(product.activeSale) === String(sale._id)) {
    product.status = 'available';
    product.activeSale = null;
    product.statusHistory.push({ status: 'available', note: `Sale reversed: ${REASON_LABELS[reason]}`, by: req.user._id });
    await product.save();
  }

  // Reservation -> back to active (if this sale had completed one)
  if (sale.reservation) {
    await Reservation.findByIdAndUpdate(sale.reservation, {
      status: 'active',
      releasedAt: null,
    });
  }

  // Lead -> restored to its pre-sale status
  if (sale.lead) {
    await Lead.findByIdAndUpdate(sale.lead, {
      $set: {
        status: sale.previousLeadStatus || 'negotiation',
        saleId: null,
        converted: false,
        convertedAt: null,
      },
      $push: { history: { status: sale.previousLeadStatus || 'negotiation', note: `Sale reversed: ${REASON_LABELS[reason]}` } },
    });
  }

  // Loan -> restored to its pre-sale status
  if (sale.loan) {
    await LoanRequest.findByIdAndUpdate(sale.loan, {
      $set: { status: sale.previousLoanStatus || 'approved', saleId: null },
      $push: { statusHistory: { status: sale.previousLoanStatus || 'approved', note: `Sale reversed: ${REASON_LABELS[reason]}`, by: req.user._id } },
    });
  }

  // Customer purchase entry -> cancelled (never removed)
  await User.updateOne(
    { _id: sale.customer, 'purchaseHistory.sale': sale._id },
    { $set: { 'purchaseHistory.$.status': 'cancelled' } }
  );

  const populated = await Sale.findById(sale._id).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).lean();

  notify({
    audience: 'dealer',
    type: 'sale_reversed',
    title: 'Sale Reversed',
    body: `${populated.product?.name || 'A product'}'s sale was reversed: ${REASON_LABELS[reason]}`,
    entityType: 'sale',
    entityId: sale._id,
    createdBy: req.user._id,
  });
  logAction({ action: 'sale_reversed', entityType: 'sale', entityId: sale._id, entityLabel: populated.product?.name, user: req.user });

  ok(res, populated, 'Sale reversed; product is available again');
});
