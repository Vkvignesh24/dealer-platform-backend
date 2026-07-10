const User = require('../models/User');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

exports.me = asyncHandler(async (req, res) => ok(res, req.user, 'Profile'));

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



