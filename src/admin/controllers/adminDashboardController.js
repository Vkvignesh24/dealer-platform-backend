const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const User = require('../../models/User');
const { ok } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

const sumOf = (agg) => (agg && agg[0] ? agg[0].value : 0);

exports.summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    totalProducts,
    totalCustomers,
    totalLeads,
    totalLoanRequests,
    availableProducts,
    reservedProducts,
    soldProducts,
    archivedProducts,
    inventoryAgg,
    soldAgg,
    monthAgg,
    yearAgg,
    longTermUnsold,
    recentProducts,
    recentLeads,
    recentLoans,
    categoryAgg,
    newCustomersThisMonth,
    recentCustomers,
  ] = await Promise.all([
    Product.countDocuments({}),
    User.countDocuments({ role: 'customer' }),
    Lead.countDocuments({}),
    LoanRequest.countDocuments({}),
    Product.countDocuments({ status: 'available' }),
    Product.countDocuments({ status: 'reserved' }),
    Product.countDocuments({ status: 'sold' }),
    Product.countDocuments({ status: 'archived' }),
    Product.aggregate([
      { $match: { status: { $in: ['available', 'reserved'] } } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: monthStart } } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: yearStart } } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.countDocuments({
      status: { $in: ['available', 'reserved'] },
      createdAt: { $lte: ninetyDaysAgo },
    }),
    Product.find({}).populate('createdBy', 'name email').sort('-createdAt').limit(6).lean(),
    Lead.find({}).populate('product', 'name category price images').sort('-createdAt').limit(6).lean(),
    LoanRequest.find({}).populate('product', 'name category price').sort('-createdAt').limit(6).lean(),
    Product.aggregate([
      { $match: { status: { $ne: 'archived' } } },
      { $group: { _id: '$category', count: { $sum: 1 }, value: { $sum: '$price' } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    User.countDocuments({ role: 'customer', createdAt: { $gte: monthStart } }),
    User.find({ role: 'customer' }).sort('-createdAt').limit(6).lean(),
  ]);

  const inventoryValue = sumOf(inventoryAgg);
  const soldValue = sumOf(soldAgg);

  ok(res, {
    totalProducts,
    totalCustomers,
    totalLeads,
    totalLoanRequests,

    availableProducts,
    reservedProducts,
    soldProducts,
    archivedProducts,

    inventoryValue,
    soldValue,
    unsoldValue: inventoryValue,

    monthlyRevenue: sumOf(monthAgg),
    yearlyRevenue: sumOf(yearAgg),

    longTermUnsold,

    recentProducts,
    recentLeads,
    recentLoans,
    recentCustomers,

    newCustomersThisMonth,
    categoryBreakdown: categoryAgg.map((c) => ({ category: c._id || 'uncategorized', count: c.count, value: c.value })),
  }, 'Admin dashboard');
});
