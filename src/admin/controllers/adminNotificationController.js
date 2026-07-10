const Notification = require('../../models/Notification');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const items = await Notification.find({}).populate('target', 'name email').sort('-createdAt').limit(100).lean();
  ok(res, { items, total: items.length }, 'Notifications');
});

exports.create = asyncHandler(async (req, res) => {
  const { audience = 'global', target, title, body } = req.body || {};
  if (!title || !body) return fail(res, 'Title and message are required', 400);
  if (!Notification.AUDIENCES.includes(audience)) return fail(res, 'Invalid audience', 400);
  if (audience !== 'global' && !target) return fail(res, 'Target user is required for this audience', 400);

  const notification = await Notification.create({
    audience,
    target: audience === 'global' ? undefined : target,
    title: String(title).trim(),
    body: String(body).trim(),
    createdBy: req.user._id,
  });

  ok(res, notification, 'Notification sent', 201);
});
