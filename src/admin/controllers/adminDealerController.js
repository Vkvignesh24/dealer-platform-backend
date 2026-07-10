const User = require('../../models/User');
const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

async function dealerStats(dealerId) {
  const [productCount, soldAgg, soldCount, productIds] = await Promise.all([
    Product.countDocuments({ createdBy: dealerId }),
    Product.aggregate([
      { $match: { createdBy: dealerId, status: 'sold' } },
      { $group: { _id: null, value: { $sum: '$price' } } },
    ]),
    Product.countDocuments({ createdBy: dealerId, status: 'sold' }),
    Product.find({ createdBy: dealerId }).distinct('_id'),
  ]);
  const leadCount = await Lead.countDocuments({ product: { $in: productIds } });
  return {
    productCount,
    leadCount,
    soldCount,
    revenue: soldAgg[0] ? soldAgg[0].value : 0,
  };
}

exports.list = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = { role: 'dealer' };
  if (search) {
    const rx = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const dealers = await User.find(filter).sort('-createdAt').lean();
  const items = await Promise.all(
    dealers.map(async (d) => ({ ...d, ...(await dealerStats(d._id)) }))
  );

  ok(res, { items, total: items.length }, 'Dealers');
});

exports.getOne = asyncHandler(async (req, res) => {
  const dealer = await User.findById(req.params.id).lean();
  if (!dealer || dealer.role !== 'dealer') return fail(res, 'Dealer not found', 404);

  const products = await Product.find({ createdBy: dealer._id }).sort('-createdAt').lean();
  const productIds = products.map((p) => p._id);
  const [leads, loans, stats] = await Promise.all([
    Lead.find({ product: { $in: productIds } }).populate('product', 'name category price').sort('-createdAt').lean(),
    LoanRequest.find({ product: { $in: productIds } }).populate('product', 'name category price').sort('-createdAt').lean(),
    dealerStats(dealer._id),
  ]);

  ok(res, { profile: dealer, stats, inventory: products, leads, loanRequests: loans }, 'Dealer detail');
});
