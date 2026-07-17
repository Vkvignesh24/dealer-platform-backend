const Settings = require('../models/Settings');
const { ok } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

// Public: customers read business info automatically.
exports.get = asyncHandler(async (req, res) => {
  const s = await Settings.getSingleton();
  ok(res, s, 'Settings');
});

// Dealer/admin: update business profile.
exports.update = asyncHandler(async (req, res) => {
  const s = await Settings.getSingleton();
  const fields = ['businessName', 'logo', 'phone', 'whatsapp', 'email', 'address', 'social', 'primaryColor'];
  for (const f of fields) {
    if (req.body[f] !== undefined) s[f] = req.body[f];
  }
  // Nested groups are merged field-by-field so a partial update (e.g. just
  // GST number) never wipes out the rest of the group.
  const groups = ['business', 'contact', 'seo', 'integrations', 'branding'];
  for (const g of groups) {
    if (req.body[g] && typeof req.body[g] === 'object') {
      s[g] = { ...(s[g]?.toObject ? s[g].toObject() : s[g] || {}), ...req.body[g] };
    }
  }
  await s.save();
  ok(res, s, 'Settings updated');
});
