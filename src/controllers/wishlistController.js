const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const { ok, fail } = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const items = await Wishlist.find({ user: req.user._id })
    .populate({ path: 'product' })
    .lean();
  ok(res, items.map((w) => w.product).filter(Boolean), 'Wishlist');
});

exports.add = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId)
    return fail(res, 'productId required');

  const product = await Product.findById(productId).select('status').lean();
  if (!product) return fail(res, 'Product not found', 404);
  if (product.status === 'reserved' || product.status === 'sold') {
    return fail(res, 'This product is currently unavailable to wishlist', 409);
  }

  const exists = await Wishlist.findOne({
    user: req.user._id,
    product: productId
  });

  if (!exists) {
    await Wishlist.create({
      user: req.user._id,
      product: productId
    });
  }

  ok(res, null, 'Added');
});

exports.remove = asyncHandler(async (req, res) => {
  await Wishlist.deleteOne({ user: req.user._id, product: req.params.id });
  ok(res, null, 'Removed from wishlist');
});
