const Notification = require('../models/Notification');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Visibility rules for "my notifications":
 * - customer: global + customer-audience broadcasts, plus anything
 *   targeted at them specifically.
 * - dealer:   global + dealer-audience broadcasts (leads/loans/sales
 *   operational alerts), plus anything targeted at them.
 * - admin:    same as dealer — admins oversee dealer operations too.
 */
function audienceQuery(user) {
  const audiences = user.role === 'customer' ? ['global', 'customer'] : ['global', 'dealer'];
  return { $or: [{ audience: { $in: audiences } }, { target: user._id }] };
}

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unread } = req.query;
  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const q = audienceQuery(req.user);

  const [items, total] = await Promise.all([
    Notification.find(q).sort('-createdAt').skip((p - 1) * l).limit(l).lean(),
    Notification.countDocuments(q),
  ]);

  const withRead = items
    .map((n) => ({ ...n, read: (n.readBy || []).some((id) => String(id) === String(req.user._id)) }))
    .filter((n) => unread !== 'true' || !n.read);

  ok(res, { items: withRead, total, page: p, pages: Math.ceil(total / l) || 1 }, 'Notifications');
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const q = { ...audienceQuery(req.user), readBy: { $ne: req.user._id } };
  const count = await Notification.countDocuments(q);
  ok(res, { count }, 'Unread count');
});

exports.markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findById(req.params.id);
  if (!n) return fail(res, 'Notification not found', 404);
  if (!n.readBy.some((id) => String(id) === String(req.user._id))) {
    n.readBy.push(req.user._id);
    await n.save();
  }
  ok(res, n, 'Marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const q = { ...audienceQuery(req.user), readBy: { $ne: req.user._id } };
  await Notification.updateMany(q, { $push: { readBy: req.user._id } });
  ok(res, { success: true }, 'All notifications marked as read');
});
