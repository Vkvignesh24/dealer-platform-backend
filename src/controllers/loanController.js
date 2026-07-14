const LoanRequest = require('../models/LoanRequest');
const Product = require('../models/Product');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (body.product) {
    const product = await Product.findById(body.product).select('status').lean();
    if (!product) return fail(res, 'Product not found', 404);
    if (product.status === 'reserved' || product.status === 'sold') {
      return fail(res, 'This product is currently unavailable for loan applications', 409);
    }
  }
  if (req.user) body.customer = req.user._id;
  const v = await LoanRequest.create(body);
  ok(res, v, 'Loan request submitted', 201);
});

exports.mine = asyncHandler(async (req, res) => {
  if (!req.user) return fail(res, 'Unauthorized', 401);
  const items = await LoanRequest.find({ customer: req.user._id })
    .populate('product', 'name brand price images status category')
    .sort('-createdAt')
    .lean();
  ok(res, items, 'My loan requests');
});

exports.list = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const q = {};
  if (status) q.status = status;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const [items, total] = await Promise.all([
    LoanRequest.find(q)
      .populate('product', 'name brand price images category')
      .populate('customer', 'displayName email phone')
      .sort('-createdAt')
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    LoanRequest.countDocuments(q),
  ]);
  ok(res, { items, total, page: p, limit: l, pages: Math.ceil(total / l) }, 'Loan requests');
});

exports.get = asyncHandler(async (req, res) => {
  const v = await LoanRequest.findById(req.params.id)
    .populate('product', 'name brand price images category')
    .populate('customer', 'displayName email phone')
    .lean();
  if (!v) return fail(res, 'Loan request not found', 404);
  ok(res, v, 'Loan request');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, dealerNote } = req.body;
  if (!LoanRequest.STATUSES.includes(status)) return fail(res, 'Invalid status', 400);
  const v = await LoanRequest.findByIdAndUpdate(
    req.params.id,
    { status, ...(dealerNote !== undefined ? { dealerNote } : {}) },
    { new: true }
  );
  if (!v) return fail(res, 'Loan request not found', 404);
  ok(res, v, 'Status updated');
});
