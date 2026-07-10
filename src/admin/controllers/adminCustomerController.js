const User = require('../../models/User');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const Wishlist = require('../../models/Wishlist');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { search } = req.query;

  const filter = { role: 'customer' };
  if (search) {
    const rx = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [customers, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const items = await Promise.all(
    customers.map(async (c) => {
      const [totalLeads, loanRequests, interestedProducts] = await Promise.all([
        Lead.countDocuments({ $or: [{ customer: c._id }, { customerEmail: c.email }] }),
        LoanRequest.countDocuments({ $or: [{ customer: c._id }, { email: c.email }] }),
        Wishlist.countDocuments({ user: c._id }),
      ]);
      return { ...c, totalLeads, loanRequests, interestedProducts };
    })
  );

  ok(res, { items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Customers');
});

exports.getOne = asyncHandler(async (req, res) => {
  const customer = await User.findById(req.params.id).lean();
  if (!customer || customer.role !== 'customer') return fail(res, 'Customer not found', 404);

  const [leads, loans, wishlist] = await Promise.all([
    Lead.find({ $or: [{ customer: customer._id }, { customerEmail: customer.email }] })
      .populate('product', 'name category price images')
      .sort('-createdAt').lean(),
    LoanRequest.find({ $or: [{ customer: customer._id }, { email: customer.email }] })
      .populate('product', 'name category price')
      .sort('-createdAt').lean(),
    Wishlist.find({ user: customer._id }).populate('product', 'name category price images status').lean(),
  ]);

  ok(res, {
    profile: customer,
    leadHistory: leads,
    loanRequests: loans,
    interestedProducts: wishlist.map((w) => w.product).filter(Boolean),
  }, 'Customer detail');
});
