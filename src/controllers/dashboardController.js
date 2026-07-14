const Product = require('../models/Product');
const Lead = require('../models/Lead');
const User = require('../models/User');
const LoanRequest = require('../models/LoanRequest');
const Sale = require('../models/Sale');
const { ok } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

function monthBucket(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

exports.summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    totalProducts,
    available,
    reserved,
    sold,
    featured,
    totalLeads,
    newLeads,
    todayLeads,
    customers,
    loanRequests,
    inventoryAgg,
    soldAgg,
    monthAgg,
    yearAgg,
    monthlySalesAgg,
    leadStatusAgg,
    loanStatusAgg,
    recentProducts,
    recentLeads,
  ] = await Promise.all([
    Product.countDocuments({ status: { $ne: 'archived' } }),
    Product.countDocuments({ status: 'available' }),
    Product.countDocuments({ status: 'reserved' }),
    Product.countDocuments({ status: 'sold' }),
    Product.countDocuments({ featured: true, status: { $ne: 'archived' } }),
    Lead.countDocuments({}),
    Lead.countDocuments({ status: 'new' }),
    Lead.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ role: 'customer' }),
    LoanRequest.countDocuments({}),
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
    Sale.aggregate([
      { $match: { status: 'active', soldDate: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { y: { $year: '$soldDate' }, m: { $month: '$soldDate' } },
          count: { $sum: 1 },
          value: { $sum: '$salePrice' },
        },
      },
    ]),
    Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    LoanRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Product.find({ status: { $ne: 'archived' } }).sort('-createdAt').limit(5).lean(),
    Lead.find().populate('product', 'name brand category price images').sort('-createdAt').limit(5).lean(),
  ]);

  // Build 12-month series
  const monthlySales = [];
  const revenueTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const match = monthlySalesAgg.find(
      (x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1
    );
    monthlySales.push({ month: monthBucket(d), count: match?.count || 0 });
    revenueTrend.push({ month: monthBucket(d), value: match?.value || 0 });
  }

  const leadConversion = leadStatusAgg.reduce((acc, r) => {
    acc[r._id] = r.n;
    return acc;
  }, {});
  const loanBreakdown = loanStatusAgg.reduce((acc, r) => {
    acc[r._id] = r.n;
    return acc;
  }, {});

  const totalLeadCount = Object.values(leadConversion).reduce((a, b) => a + b, 0);
  const convertedLeadCount = (leadConversion.sold || 0) + (leadConversion.booked || 0);
  const leadConversionRate = totalLeadCount ? Math.round((convertedLeadCount / totalLeadCount) * 1000) / 10 : 0;

  const totalLoanCount = Object.values(loanBreakdown).reduce((a, b) => a + b, 0);
  const approvedLoanCount = (loanBreakdown.approved || 0) + (loanBreakdown.disbursed || 0);
  const loanConversionRate = totalLoanCount ? Math.round((approvedLoanCount / totalLoanCount) * 1000) / 10 : 0;

  ok(res, {
    counts: {
      totalProducts, available, reserved, sold, featured,
      totalLeads, newLeads, todayLeads, customers, loanRequests,
    },
    value: {
      inventoryValue: inventoryAgg[0]?.value || 0,
      soldValue: soldAgg[0]?.value || 0,
      reservedValue: 0,
      unsoldValue: inventoryAgg[0]?.value || 0,
      monthlyRevenue: monthAgg[0]?.value || 0,
      yearlyRevenue: yearAgg[0]?.value || 0,
    },
    conversion: {
      leadConversionRate,
      loanConversionRate,
      loanStatusBreakdown: loanBreakdown,
    },
    charts: {
      monthlySales,
      revenueTrend,
      leadConversion,
      inventoryStatus: { available, reserved, sold },
    },
    recentProducts,
    recentLeads,
  }, 'Dashboard');
});
