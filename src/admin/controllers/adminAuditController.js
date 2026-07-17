const AuditLog = require('../../models/AuditLog');
const { ok } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, entityType } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  const q = {};
  if (action) q.action = action;
  if (entityType) q.entityType = entityType;

  const [items, total] = await Promise.all([
    AuditLog.find(q).sort('-createdAt').skip((p - 1) * l).limit(l).lean(),
    AuditLog.countDocuments(q),
  ]);
  ok(res, { items, total, page: p, pages: Math.ceil(total / l) || 1 }, 'Audit log');
});

// Powers the Profile page's "Recent Activity" card — one most-recent
// entry per tracked action type (last product update, last lead update,
// last loan update, last sale).
exports.recent = asyncHandler(async (req, res) => {
  const actions = ['product_created', 'product_updated', 'lead_updated', 'loan_updated', 'sale_created', 'sale_reversed'];
  const results = await Promise.all(
    actions.map((action) => AuditLog.findOne({ action }).sort('-createdAt').lean())
  );
  ok(res, results.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), 'Recent activity');
});
