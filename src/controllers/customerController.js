const User = require('../models/User');
const Lead = require('../models/Lead');
const { ok } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

// Dealer/admin view of customers, enriched with lead activity.
exports.list = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const q = { role: 'customer' };
  if (search) {
    q.$or = [
      { name: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));

  const [users, total] = await Promise.all([
    User.find(q).sort('-createdAt').skip((p - 1) * l).limit(l).lean(),
    User.countDocuments(q),
  ]);

  const items = await Promise.all(
    users.map(async (u) => {
      const leadCount = await Lead.countDocuments({ customer: u._id });
      const interested = await Lead.find({ customer: u._id })
        .populate('product', 'name brand')
        .sort('-createdAt')
        .limit(5)
        .lean();
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar,
        createdAt: u.createdAt,
        leadCount,
        interestedProducts: interested.map((x) => x.product).filter(Boolean),
      };
    })
  );

  ok(res, { items, total, page: p, pages: Math.ceil(total / l) }, 'Customers');
});
