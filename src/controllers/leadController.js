const Lead = require('../models/Lead');
const Product = require('../models/Product');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

const POPULATE = { path: 'product', select: 'name brand category price images' };

exports.list = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const q = {};
  if (status) q.status = status;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Lead.find(q).populate(POPULATE).sort('-createdAt').skip((p - 1) * l).limit(l).lean(),
    Lead.countDocuments(q),
  ]);

  ok(res, { items, total, page: p, pages: Math.ceil(total / l) }, 'Leads');
});

// Leads belonging to the signed-in customer ("Interested Products").
exports.myLeads = asyncHandler(async (req, res) => {
  const items = await Lead.find({ customer: req.user._id })
    .populate(POPULATE)
    .sort('-createdAt')
    .lean();
  ok(res, items, 'My leads');
});

exports.create = asyncHandler(async (req, res) => {
  const { productId, customerName, customerPhone, customerEmail, message } = req.body;
  const v = await Product.findById(productId);
  if (!v) return fail(res, 'Product not found', 404);
  if (v.status === 'reserved' || v.status === 'sold') {
    return fail(res, 'This product is currently unavailable for enquiries', 409);
  }

  const recent = await Lead.findOne({
    product: productId,
    customerPhone,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recent) return fail(res, 'You already submitted an enquiry recently', 429);

  const lead = await Lead.create({
    product: productId,
    customer: req.user ? req.user._id : undefined,
    customerName,
    customerPhone,
    customerEmail,
    message,
    status: 'new',
    history: [{ status: 'new' }],
  });
  ok(res, lead, 'Enquiry submitted', 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { status, note, response } = req.body;
  const lead = await Lead.findById(req.params.id);
  if (!lead) return fail(res, 'Lead not found', 404);
  if (status && lead.status !== status) {
    lead.history.push({ status, note });
    lead.status = status;
  }
  if (response !== undefined) lead.response = response;
  await lead.save();
  ok(res, lead, 'Lead updated');
});

exports.get = asyncHandler(async (req, res) => {
  const l = await Lead.findById(req.params.id).populate(POPULATE).lean();
  if (!l) return fail(res, 'Lead not found', 404);
  ok(res, l, 'Lead');
});
