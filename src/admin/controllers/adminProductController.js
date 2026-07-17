const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const Wishlist = require('../../models/Wishlist');
const Sale = require('../../models/Sale');
const Reservation = require('../../models/Reservation');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');
const { logAction } = require('../../services/auditService');

const EDITABLE = [
  'name', 'category', 'subcategory', 'brand', 'model', 'variant',
  'year', 'price', 'description', 'location', 'images', 'features',
  'specifications', 'featured', 'video',
];
const STATUSES = ['available', 'reserved', 'sold', 'archived'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { search, category, status, dealer, brand, minPrice, maxPrice } = req.query;

  const filter = {};
  if (category) filter.category = String(category).toLowerCase();
  if (status) filter.status = status;
  if (dealer) filter.createdBy = dealer;
  if (brand) filter.brand = { $regex: String(brand).trim(), $options: 'i' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) {
    const term = String(search).toLowerCase().replace(/\s+/g, ' ').trim();
    filter.searchKey = { $regex: term.split(' ').map((t) => `(?=.*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join(''), $options: 'i' };
  }

  // Sort allowlist — falls back to newest-first for anything unrecognized,
  // matching the previous hardcoded behaviour exactly.
  const SORTS = {
    newest: '-createdAt',
    oldest: 'createdAt',
    price_asc: 'price',
    price_desc: '-price',
    views: '-views',
  };
  const sort = SORTS[req.query.sort] || '-createdAt';

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  ok(res, { items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Products');
});

exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('createdBy', 'name email phone').lean();
  if (!product) return fail(res, 'Product not found', 404);

  // Engagement counts — additive only, the product object's own fields are
  // unchanged. Powers the Lead Count / Loan Requests / Interested
  // Customers stats the brief asks for on the Product Detail page.
  const [leadCount, loanCount, wishlistCount, sale, reservation, leads, loans, saleHistory, reservationHistory] = await Promise.all([
    Lead.countDocuments({ product: product._id }),
    LoanRequest.countDocuments({ product: product._id }),
    Wishlist.countDocuments({ product: product._id }),
    product.status === 'sold'
      ? Sale.findOne({ product: product._id, status: 'active' }).populate('customer', 'name email phone').lean()
      : null,
    product.status === 'reserved'
      ? Reservation.findOne({ product: product._id, status: 'active' }).populate('customer', 'name email phone').lean()
      : null,
    Lead.find({ product: product._id }).sort('-createdAt').limit(4).lean(),
    LoanRequest.find({ product: product._id }).sort('-createdAt').limit(3).lean(),
    // Every sale this product has ever had — sold, reversed, sold again.
    // Nothing here is ever deleted; this is the audit trail.
    Sale.find({ product: product._id }).populate('customer', 'name email phone').sort('-soldDate').lean(),
    Reservation.find({ product: product._id }).populate('customer', 'name email phone').sort('-reservedAt').lean(),
  ]);

  const timeline = buildProductTimeline(product, saleHistory, reservationHistory, leads);

  ok(res, {
    ...product, leadCount, loanCount, wishlistCount, sale, reservation, leads, loans,
    saleHistory, reservationHistory, timeline,
  }, 'Product');
});

/**
 * Merges product statusHistory + every sale + every reservation + lead
 * creation into a single chronological feed for the "Activity Timeline"
 * card. Nothing feeding this is ever deleted, so the timeline is a
 * permanent record — a product can show "Sold to Vicky", "Sale Reversed",
 * "Reserved by Arun", "Sold to Arun" all in sequence.
 */
function buildProductTimeline(product, sales, reservations, leads) {
  const events = [];

  events.push({ at: product.createdAt, type: 'created', label: 'Product Created' });

  (product.statusHistory || []).forEach((h) => {
    if (h.status === 'available' && events.length === 1) return; // skip redundant initial entry
    events.push({ at: h.at, type: 'status', label: statusLabel(h.status), note: h.note });
  });

  (leads || []).forEach((l) => {
    events.push({ at: l.createdAt, type: 'lead', label: `Enquiry from ${l.customerName}` });
  });

  (reservations || []).forEach((r) => {
    events.push({
      at: r.reservedAt,
      type: 'reservation',
      label: `Reserved by ${r.customer?.name || 'customer'}`,
      note: r.bookingAmount ? `Booking amount ₹${Number(r.bookingAmount).toLocaleString('en-IN')}` : undefined,
    });
    if (r.releasedAt && r.status === 'cancelled') {
      events.push({ at: r.releasedAt, type: 'reservation_released', label: 'Reservation released' });
    }
  });

  (sales || []).forEach((s) => {
    events.push({
      at: s.soldDate,
      type: 'sale',
      label: `Sold to ${s.customer?.name || 'customer'}`,
      note: `₹${Number(s.salePrice).toLocaleString('en-IN')}`,
    });
    if (s.status === 'reversed' && s.reversedAt) {
      events.push({
        at: s.reversedAt,
        type: 'reverse',
        label: 'Sale Reversed',
        note: s.reverseReason ? s.reverseReason.replace(/_/g, ' ') : undefined,
      });
    }
  });

  return events
    .filter((e) => e.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

function statusLabel(status) {
  const map = {
    available: 'Marked Available',
    reserved: 'Reserved',
    sold: 'Sold',
    archived: 'Archived',
  };
  return map[status] || `Status changed to ${status}`;
}

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);

  for (const key of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) product[key] = req.body[key];
  }
  if (req.body.status && req.body.status !== product.status) {
    if (req.body.status === 'sold' || req.body.status === 'reserved') {
      return fail(res, 'Use the Mark As Sold / Reserve Product action to change this status', 400);
    }
    if (!STATUSES.includes(req.body.status)) return fail(res, 'Invalid status', 400);
    product.statusHistory.push({ status: req.body.status, at: new Date(), note: 'Updated by admin', by: req.user._id });
    product.status = req.body.status;
    if (req.body.status === 'available') product.activeReservation = null;
  }
  await product.save();
  logAction({ action: 'product_updated', entityType: 'product', entityId: product._id, entityLabel: product.name, user: req.user });
  ok(res, product, 'Product updated');
});

exports.duplicate = asyncHandler(async (req, res) => {
  const source = await Product.findById(req.params.id).lean();
  if (!source) return fail(res, 'Product not found', 404);

  const clone = {};
  for (const key of EDITABLE) {
    if (source[key] !== undefined) clone[key] = source[key];
  }
  clone.name = `${source.name} (Copy)`;
  clone.featured = false;

  const created = await Product.create({
    ...clone,
    createdBy: req.user._id,
    statusHistory: [{ status: 'available', note: `Duplicated from ${source.name}`, by: req.user._id }],
  });
  logAction({ action: 'product_created', entityType: 'product', entityId: created._id, entityLabel: created.name, user: req.user });
  ok(res, created, 'Product duplicated', 201);
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return fail(res, 'Invalid status', 400);
  if (status === 'sold') {
    return fail(res, 'Use the "Mark As Sold" action to sell a product', 400);
  }
  if (status === 'reserved') {
    return fail(res, 'Use the "Reserve Product" action to reserve a product', 400);
  }
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  product.status = status;
  if (status === 'available') product.activeReservation = null;
  product.statusHistory.push({ status, at: new Date(), note: 'Status changed by admin', by: req.user._id });
  await product.save();
  ok(res, product, 'Status updated');
});

exports.archive = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  product.status = 'archived';
  product.statusHistory.push({ status: 'archived', at: new Date(), note: 'Archived by admin', by: req.user._id });
  await product.save();
  ok(res, product, 'Product archived');
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  ok(res, { id: req.params.id }, 'Product deleted');
});
