const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const User = require('../../models/User');
const Sale = require('../../models/Sale');
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
    leadStatusAgg,
    loanStatusAgg,
    avgSaleAgg,
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
    Sale.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, value: { $sum: '$salePrice' } } }]),
    Sale.aggregate([
      { $match: { status: 'active', soldDate: { $gte: monthStart } } },
      { $group: { _id: null, value: { $sum: '$salePrice' } } },
    ]),
    Sale.aggregate([
      { $match: { status: 'active', soldDate: { $gte: yearStart } } },
      { $group: { _id: null, value: { $sum: '$salePrice' } } },
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
    Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    LoanRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Sale.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, avg: { $avg: '$salePrice' }, count: { $sum: 1 } } }]),
  ]);

  const inventoryValue = sumOf(inventoryAgg);
  const soldValue = sumOf(soldAgg);

  const leadBreakdown = leadStatusAgg.reduce((acc, r) => { acc[r._id] = r.n; return acc; }, {});
  const totalLeadCount = Object.values(leadBreakdown).reduce((a, b) => a + b, 0);
  const convertedLeadCount = (leadBreakdown.sold || 0) + (leadBreakdown.booked || 0);
  const leadConversionRate = totalLeadCount ? Math.round((convertedLeadCount / totalLeadCount) * 1000) / 10 : 0;

  const loanBreakdown = loanStatusAgg.reduce((acc, r) => { acc[r._id] = r.n; return acc; }, {});
  const totalLoanCount = Object.values(loanBreakdown).reduce((a, b) => a + b, 0);
  const approvedLoanCount = (loanBreakdown.approved || 0) + (loanBreakdown.disbursed || 0);
  const loanConversionRate = totalLoanCount ? Math.round((approvedLoanCount / totalLoanCount) * 1000) / 10 : 0;

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
    averageSaleValue: avgSaleAgg[0]?.avg || 0,
    totalSalesCount: avgSaleAgg[0]?.count || 0,

    leadConversionRate,
    loanConversionRate,
    loanStatusBreakdown: loanBreakdown,

    longTermUnsold,

    recentProducts,
    recentLeads,
    recentLoans,
    recentCustomers,

    newCustomersThisMonth,
    categoryBreakdown: categoryAgg.map((c) => ({ category: c._id || 'uncategorized', count: c.count, value: c.value })),
  }, 'Admin dashboard');
});
