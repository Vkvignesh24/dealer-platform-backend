const Product = require('../models/Product');
const Lead = require('../models/Lead');
const User = require('../models/User');
const LoanRequest = require('../models/LoanRequest');
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
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { y: { $year: '$updatedAt' }, m: { $month: '$updatedAt' } },
          count: { $sum: 1 },
          value: { $sum: '$price' },
        },
      },
    ]),
    Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
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

  ok(res, {
    counts: {
      totalProducts, available, reserved, sold, featured,
      totalLeads, newLeads, todayLeads, customers, loanRequests,
    },
    value: {
      inventoryValue: inventoryAgg[0]?.value || 0,
      soldValue: soldAgg[0]?.value || 0,
      unsoldValue: inventoryAgg[0]?.value || 0,
      monthlyRevenue: monthAgg[0]?.value || 0,
      yearlyRevenue: yearAgg[0]?.value || 0,
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
