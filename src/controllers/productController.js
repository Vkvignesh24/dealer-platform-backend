const Product = require('../models/Product');
const Lead = require('../models/Lead');
const Sale = require('../models/Sale');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

// Dealer/admin see the full inventory including sold items (they manage
// it). Customers (and anonymous visitors) never see `sold` products in
// browse surfaces — only inside their own purchase history.
function isDealerOrAdmin(req) {
  return !!(req.user && (req.user.role === 'dealer' || req.user.role === 'admin'));
}

// Required spec keys per category. Unknown categories are allowed through.
const SPEC_REQUIREMENTS = {
  car: ['fuel', 'transmission', 'year', 'mileage', 'ownership'],
  bike: ['engine', 'mileage', 'year', 'ownership'],
  land: ['area', 'unit', 'surveyNumber'],
  property: ['bedrooms', 'bathrooms', 'area', 'furnishing'],
  commercial: ['fuel', 'transmission', 'year', 'payload'],
  ev: ['range', 'battery', 'year', 'transmission'],
};

// Filters that should be applied against `specifications.<key>` instead of root.
const SPEC_FILTER_KEYS = [
  'fuel',
  'transmission',
  'ownership',
  'bedrooms',
  'bathrooms',
  'furnishing',
  'engine',
];

function normalizeSearch(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function validateSpecs(category, specifications) {
  const required = SPEC_REQUIREMENTS[String(category || '').toLowerCase()];
  if (!required) return null;
  const provided = specifications || {};
  const missing = required.filter((k) => {
    const v = provided[k] ?? (provided.get && provided.get(k));
    return v === undefined || v === null || v === '';
  });
  if (missing.length) return `Missing required specifications: ${missing.join(', ')}`;
  return null;
}

exports.list = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    subcategory,
    brand,
    minPrice,
    maxPrice,
    year,
    location,
    status,
    featured,
    minArea,
    maxArea,
    sort = '-createdAt',
    page = 1,
    limit = 20,
  } = req.query;

  const q = {};
  if (category) q.category = String(category).toLowerCase();
  if (subcategory) q.subcategory = subcategory;
  if (brand) q.brand = new RegExp(`^${String(brand).trim()}$`, 'i');
  if (year) q.year = Number(year);
  if (location) q.location = new RegExp(String(location).trim(), 'i');
  if (featured !== undefined) q.featured = featured === 'true' || featured === true;

  const privileged = isDealerOrAdmin(req);
  if (status) {
    // Anonymous/customer requests can never explicitly ask for sold or
    // archived inventory — those only exist for dealer/admin management.
    if (!privileged && (status === 'sold' || status === 'archived')) {
      q.status = 'available';
    } else {
      q.status = status;
    }
  } else {
    q.status = privileged ? { $ne: 'archived' } : { $nin: ['archived', 'sold'] };
  }
  if (minPrice || maxPrice) {
    q.price = {};
    if (minPrice) q.price.$gte = Number(minPrice);
    if (maxPrice) q.price.$lte = Number(maxPrice);
  }

  // Spec-based filters
  for (const key of SPEC_FILTER_KEYS) {
    if (req.query[key] !== undefined && req.query[key] !== '') {
      q[`specifications.${key}`] = new RegExp(`^${String(req.query[key]).trim()}$`, 'i');
    }
  }
  if (minArea || maxArea) {
    // area stored as string in specifications; rough numeric compare via $expr
    q.$expr = q.$expr || { $and: [] };
    if (minArea)
      q.$expr.$and.push({ $gte: [{ $toDouble: '$specifications.area' }, Number(minArea)] });
    if (maxArea)
      q.$expr.$and.push({ $lte: [{ $toDouble: '$specifications.area' }, Number(maxArea)] });
  }

  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const skip = (p - 1) * l;

  // Text search first; fall back to regex on normalized fields.
  if (search) {
    const term = normalizeSearch(search);
    const textQ = { ...q, $text: { $search: term } };
    let [items, total] = await Promise.all([
      Product.find(textQ).sort(sort).skip(skip).limit(l).lean(),
      Product.countDocuments(textQ),
    ]);
    if (total === 0) {
      const rx = new RegExp(term.split(' ').map((p) => `(?=.*${p})`).join(''), 'i');
      const fallbackQ = {
        ...q,
        $or: [
          { searchKey: rx },
          { name: rx },
          { brand: rx },
          { model: rx },
        ],
      };
      [items, total] = await Promise.all([
        Product.find(fallbackQ).sort(sort).skip(skip).limit(l).lean(),
        Product.countDocuments(fallbackQ),
      ]);
    }
    return ok(res, { items, total, page: p, limit: l, pages: Math.ceil(total / l) }, 'Products');
  }

  const [items, total] = await Promise.all([
    Product.find(q).sort(sort).skip(skip).limit(l).lean(),
    Product.countDocuments(q),
  ]);
  ok(res, { items, total, page: p, limit: l, pages: Math.ceil(total / l) }, 'Products');
});

exports.featured = asyncHandler(async (req, res) => {
  const items = await Product.find({ featured: true, status: 'available' })
    .sort('-createdAt')
    .limit(10)
    .lean();
  ok(res, items, 'Featured products');
});

exports.recent = asyncHandler(async (req, res) => {
  const q = isDealerOrAdmin(req) ? { status: { $ne: 'archived' } } : { status: { $nin: ['archived', 'sold'] } };
  const items = await Product.find(q)
    .sort('-createdAt')
    .limit(10)
    .lean();
  ok(res, items, 'Recent products');
});

exports.recommended = asyncHandler(async (req, res) => {
  // Simple recommendation: most-viewed available products.
  const items = await Product.find({ status: 'available' })
    .sort('-views -createdAt')
    .limit(10)
    .lean();
  ok(res, items, 'Recommended products');
});

exports.categories = asyncHandler(async (req, res) => {
  const q = isDealerOrAdmin(req) ? { status: { $ne: 'archived' } } : { status: { $nin: ['archived', 'sold'] } };
  const cats = await Product.distinct('category', q);
  ok(res, cats.filter(Boolean).sort(), 'Categories');
});

exports.get = asyncHandler(async (req, res) => {
  const existing = await Product.findById(req.params.id).lean();
  if (!existing) return fail(res, 'Product not found', 404);

  // Sold products are hidden from everyone except dealer/admin and the
  // customer who actually purchased them (their purchase history).
  if (existing.status === 'sold' && !isDealerOrAdmin(req)) {
    const owns = req.user
      ? await Sale.exists({ product: existing._id, customer: req.user._id })
      : false;
    if (!owns) return fail(res, 'Product not found', 404);
  }

  const v = await Product.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  ).lean();

  if (isDealerOrAdmin(req)) {
    const [leadCount, interestedCount] = await Promise.all([
      Lead.countDocuments({ product: v._id }),
      Lead.countDocuments({ product: v._id, status: 'interested' }),
    ]);
    v.leadCount = leadCount;
    v.interestedCount = interestedCount;
  }

  // Guides the customer app: reserved products stay visible but with
  // customer actions (loan/interested/call/whatsapp/wishlist) disabled.
  v.restrictedActions = v.status === 'reserved' || v.status === 'sold';

  ok(res, v, 'Product');
});

exports.create = asyncHandler(async (req, res) => {
  const err = validateSpecs(req.body.category, req.body.specifications);
  if (err) return fail(res, err, 400);
  const v = await Product.create({
    ...req.body,
    createdBy: req.user._id,
    statusHistory: [{ status: req.body.status || 'available', by: req.user._id }],
  });
  ok(res, v, 'Product created', 201);
});

exports.update = asyncHandler(async (req, res) => {
  // Status changes to sold/reserved must go through the dedicated
  // sale/reservation endpoints so a business record is always created.
  if (req.body.status === 'sold' || req.body.status === 'reserved') {
    return fail(res, 'Use the Mark As Sold / Reserve Product flow to change this status', 400);
  }
  if (req.body.specifications || req.body.category) {
    const existing = await Product.findById(req.params.id).lean();
    if (!existing) return fail(res, 'Product not found', 404);
    const merged = {
      ...(existing.specifications || {}),
      ...(req.body.specifications || {}),
    };
    const err = validateSpecs(req.body.category || existing.category, merged);
    if (err) return fail(res, err, 400);
  }
  const v = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!v) return fail(res, 'Product not found', 404);
  ok(res, v, 'Product updated');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!Product.STATUSES.includes(status)) return fail(res, 'Invalid status', 400);

  // These two transitions must create an auditable business record
  // (who bought it / who booked it) — see POST /sales and POST /reservations.
  if (status === 'sold') {
    return fail(res, 'Use the "Mark As Sold" flow (POST /sales) to sell a product', 400);
  }
  if (status === 'reserved') {
    return fail(res, 'Use the "Reserve Product" flow (POST /reservations) to reserve a product', 400);
  }

  const p = await Product.findById(req.params.id);
  if (!p) return fail(res, 'Product not found', 404);
  p.status = status;
  if (status === 'available') p.activeReservation = null;
  p.statusHistory.push({ status, note, by: req.user?._id });
  await p.save();
  ok(res, p, 'Status updated');
});

exports.remove = asyncHandler(async (req, res) => {
  const v = await Product.findByIdAndUpdate(
    req.params.id,
    { status: 'archived', $push: { statusHistory: { status: 'archived', by: req.user?._id } } },
    { new: true }
  );
  if (!v) return fail(res, 'Product not found', 404);
  ok(res, v, 'Product archived');
});
