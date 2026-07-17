const Product = require('../models/Product');
const Reservation = require('../models/Reservation');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');

const POPULATE_PRODUCT = { path: 'product', select: 'name brand category price images status' };
const POPULATE_CUSTOMER = { path: 'customer', select: 'name email phone' };

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
    const err = new Error('customerId is required for an existing customer');
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
 * POST /reservations — "Reserve Product"
 * The only legitimate way a product's status becomes `reserved`.
 */
exports.create = asyncHandler(async (req, res) => {
  const {
    productId,
    customerType = 'existing',
    customerId,
    walkIn,
    leadId,
    bookingAmount = 0,
    expectedDeliveryDate,
    remarks,
  } = req.body;

  if (!productId) return fail(res, 'productId is required', 400);

  const product = await Product.findById(productId);
  if (!product) return fail(res, 'Product not found', 404);
  if (product.status === 'sold') return fail(res, 'This product is already sold', 409);
  if (product.status === 'archived') return fail(res, 'Cannot reserve an archived product', 409);
  if (product.status === 'reserved') return fail(res, 'This product is already reserved', 409);

  const customer = await resolveCustomer({ customerType, customerId, walkIn });

  let lead = null;
  if (leadId) {
    lead = await Lead.findById(leadId);
    if (!lead) return fail(res, 'Lead not found', 404);
  }

  const reservation = await Reservation.create({
    product: product._id,
    customer: customer._id,
    customerType,
    lead: lead ? lead._id : null,
    bookingAmount: Number(bookingAmount) || 0,
    expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
    remarks,
    status: 'active',
    reservedBy: req.user._id,
  });

  product.status = 'reserved';
  product.activeReservation = reservation._id;
  product.statusHistory.push({ status: 'reserved', note: 'Reservation recorded', by: req.user._id });
  await product.save();

  if (lead && !['booked', 'sold'].includes(lead.status)) {
    lead.history.push({ status: 'booked', note: 'Product reserved' });
    lead.status = 'booked';
    await lead.save();
  }

  const populated = await Reservation.findById(reservation._id)
    .populate(POPULATE_PRODUCT)
    .populate(POPULATE_CUSTOMER)
    .lean();

  notify({
    audience: 'dealer',
    type: 'product_reserved',
    title: 'Product Reserved',
    body: `${populated.product?.name || 'A product'} was reserved by ${populated.customer?.name || 'a customer'}`,
    entityType: 'product',
    entityId: product._id,
    createdBy: req.user._id,
  });

  ok(res, populated, 'Product reserved', 201);
});

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, product } = req.query;
  const q = {};
  if (status) q.status = status;
  if (product) q.product = product;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const [items, total] = await Promise.all([
    Reservation.find(q).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).sort('-reservedAt').skip((p - 1) * l).limit(l).lean(),
    Reservation.countDocuments(q),
  ]);
  ok(res, { items, total, page: p, pages: Math.ceil(total / l) || 1 }, 'Reservations');
});

exports.get = asyncHandler(async (req, res) => {
  const r = await Reservation.findById(req.params.id).populate(POPULATE_PRODUCT).populate(POPULATE_CUSTOMER).lean();
  if (!r) return fail(res, 'Reservation not found', 404);
  ok(res, r, 'Reservation');
});

/**
 * PATCH /reservations/:id/release — cancels a reservation and reopens the
 * product as available (booking amount refunded or forfeited is a business
 * decision handled outside this API).
 */
exports.release = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return fail(res, 'Reservation not found', 404);
  if (reservation.status !== 'active') return fail(res, 'Reservation is not active', 409);

  reservation.status = 'cancelled';
  reservation.releasedAt = new Date();
  await reservation.save();

  const product = await Product.findById(reservation.product);
  if (product && product.status === 'reserved') {
    product.status = 'available';
    product.activeReservation = null;
    product.statusHistory.push({ status: 'available', note: 'Reservation released', by: req.user._id });
    await product.save();
  }

  ok(res, reservation, 'Reservation released');
});
