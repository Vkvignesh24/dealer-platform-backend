const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const { ok } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

const sumOf = (agg) => (agg && agg[0] ? agg[0].value : 0);

exports.inventory = asyncHandler(async (req, res) => {
  const [available, reserved, sold, archived, inventoryAgg, soldAgg, categoryAgg] = await Promise.all([
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
      { $match: { status: { $ne: 'archived' } } },
      { $group: { _id: '$category', count: { $sum: 1 }, value: { $sum: '$price' } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const inventoryValue = sumOf(inventoryAgg);
  ok(res, {
    available, reserved, sold, archived,
    inventoryValue,
    soldValue: sumOf(soldAgg),
    unsoldValue: inventoryValue,
    categoryBreakdown: categoryAgg.map((c) => ({ category: c._id || 'uncategorized', count: c.count, value: c.value })),
  }, 'Inventory analytics');
});

exports.leads = asyncHandler(async (req, res) => {
  const statusAgg = await Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const breakdown = statusAgg.reduce((acc, r) => { acc[r._id] = r.n; return acc; }, {});
  const totalLeads = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const convertedLeads = (breakdown.sold || 0) + (breakdown.booked || 0);
  const lostLeads = breakdown.lost || 0;
  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;
  ok(res, { totalLeads, convertedLeads, lostLeads, conversionRate, statusBreakdown: breakdown }, 'Lead analytics');
});

exports.revenue = asyncHandler(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [monthAgg, yearAgg, soldAgg, trendAgg, dealerAgg] = await Promise.all([
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: monthStart } } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: yearStart } } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold', updatedAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { y: { $year: '$updatedAt' }, m: { $month: '$updatedAt' } }, value: { $sum: '$price' }, count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { status: 'sold' } },
      { $group: { _id: '$createdBy', value: { $sum: '$price' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'dealer' } },
      { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, value: 1, count: 1, dealerName: '$dealer.name' } },
      { $sort: { value: -1 } },
    ]),
  ]);

  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = trendAgg.find((x) => x._id.y === d.getFullYear() && x._id.m === d.getMonth() + 1);
    trend.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      value: m ? m.value : 0,
      count: m ? m.count : 0,
    });
  }

  ok(res, {
    monthlyRevenue: sumOf(monthAgg),
    yearlyRevenue: sumOf(yearAgg),
    soldValue: sumOf(soldAgg),
    revenueTrend: trend,
    dealerRevenue: dealerAgg,
  }, 'Revenue analytics');
});

exports.aging = asyncHandler(async (req, res) => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const products = await Product.find({ status: { $in: ['available', 'reserved'] } })
    .populate('createdBy', 'name email')
    .sort('createdAt')
    .lean();

  const buckets = { '30': 0, '60': 0, '90': 0, '180': 0 };
  const items = products.map((p) => {
    const daysUnsold = Math.floor((now - new Date(p.createdAt).getTime()) / day);
    if (daysUnsold >= 180) buckets['180'] += 1;
    else if (daysUnsold >= 90) buckets['90'] += 1;
    else if (daysUnsold >= 60) buckets['60'] += 1;
    else if (daysUnsold >= 30) buckets['30'] += 1;
    return {
      _id: p._id,
      productName: p.name,
      category: p.category,
      price: p.price,
      status: p.status,
      dealer: p.createdBy ? p.createdBy.name : 'Unassigned',
      daysUnsold,
      createdAt: p.createdAt,
    };
  }).sort((a, b) => b.daysUnsold - a.daysUnsold);

  ok(res, { buckets, items }, 'Inventory aging');
});
