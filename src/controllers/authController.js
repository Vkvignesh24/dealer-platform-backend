const User = require('../models/User');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

exports.me = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id)
    .populate('purchaseHistory.product', 'name brand category price images')
    .lean();
  ok(res, u, 'Profile');
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  // req.user is set by authenticate middleware (firebase verified)
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { name, email: email.toLowerCase(), phone },
    { new: true }
  );
  return ok(res, updated, 'Profile updated');
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const u = await User.findByIdAndUpdate(
    req.user._id,
    { ...(name && { name }), ...(phone && { phone }), ...(avatar && { avatar }) },
    { new: true }
  );
  return ok(res, u, 'Profile updated');
});

// Registers/refreshes this device's Firebase Cloud Messaging token so the
// backend can push notifications (new lead, loan approved, etc.) to it.
exports.registerFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return fail(res, 'token is required', 400);
  await User.findByIdAndUpdate(req.user._id, { fcmToken: token });
  ok(res, { success: true }, 'Push token registered');
});

// Forgets this device's token — called on logout so a signed-out device
// never receives another push meant for whoever logs in next.
exports.removeFcmToken = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { fcmToken: null });
  ok(res, { success: true }, 'Push token removed');
});



