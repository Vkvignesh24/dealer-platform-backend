const LoanRequest = require('../../models/LoanRequest');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

const STATUSES = ['new', 'under_review', 'bank_shared', 'approved', 'rejected'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { status, search, product } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (product) filter.product = product;
  if (search) {
    const rx = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    LoanRequest.find(filter)
      .populate({ path: 'product', select: 'name category price createdBy images', populate: { path: 'createdBy', select: 'name email' } })
      .populate('customer', 'name email phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    LoanRequest.countDocuments(filter),
  ]);

  ok(res, { items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Loan requests');
});

exports.getOne = asyncHandler(async (req, res) => {
  const loan = await LoanRequest.findById(req.params.id)
    .populate({ path: 'product', select: 'name category price createdBy images', populate: { path: 'createdBy', select: 'name email phone' } })
    .populate('customer', 'name email phone')
    .lean();
  if (!loan) return fail(res, 'Loan request not found', 404);
  ok(res, loan, 'Loan request');
});

exports.update = asyncHandler(async (req, res) => {
  const { status, note } = req.body || {};
  const loan = await LoanRequest.findById(req.params.id);
  if (!loan) return fail(res, 'Loan request not found', 404);

  if (status) {
    if (!STATUSES.includes(status)) return fail(res, 'Invalid status', 400);
    loan.status = status;
    if (!Array.isArray(loan.statusHistory)) loan.statusHistory = [];
    loan.statusHistory.push({ status, at: new Date(), note: note || '', by: req.user._id });
  }
  if (!status && note && String(note).trim()) {
    if (!Array.isArray(loan.notes)) loan.notes = [];
    loan.notes.push({ text: String(note).trim(), at: new Date(), by: req.user._id });
  }
  await loan.save();
  ok(res, loan, 'Loan updated');
});

exports.analytics = asyncHandler(async (req, res) => {
  const statusAgg = await LoanRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const breakdown = statusAgg.reduce((acc, r) => { acc[r._id] = r.n; return acc; }, {});

  const totalRequests = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const approved = breakdown.approved || 0;
  const rejected = breakdown.rejected || 0;
  const pending = (breakdown.new || 0) + (breakdown.under_review || 0) + (breakdown.bank_shared || 0);
  const approvalRate = totalRequests ? Math.round((approved / totalRequests) * 1000) / 10 : 0;

  ok(res, { totalRequests, approved, rejected, pending, approvalRate, statusBreakdown: breakdown }, 'Loan analytics');
});
