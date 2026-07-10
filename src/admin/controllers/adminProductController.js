const Product = require('../../models/Product');
const Lead = require('../../models/Lead');
const LoanRequest = require('../../models/LoanRequest');
const Wishlist = require('../../models/Wishlist');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');

const EDITABLE = [
  'name', 'category', 'subcategory', 'brand', 'model', 'variant',
  'year', 'price', 'description', 'location', 'images', 'features',
  'specifications', 'featured', 'video',
];
const STATUSES = ['available', 'reserved', 'sold', 'archived'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { search, category, status, dealer, brand, minPrice, maxPrice } = req.query;

  const filter = {};
  if (category) filter.category = String(category).toLowerCase();
  if (status) filter.status = status;
  if (dealer) filter.createdBy = dealer;
  if (brand) filter.brand = { $regex: String(brand).trim(), $options: 'i' };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) {
    const term = String(search).toLowerCase().replace(/\s+/g, ' ').trim();
    filter.searchKey = { $regex: term.split(' ').map((t) => `(?=.*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join(''), $options: 'i' };
  }

  // Sort allowlist — falls back to newest-first for anything unrecognized,
  // matching the previous hardcoded behaviour exactly.
  const SORTS = {
    newest: '-createdAt',
    oldest: 'createdAt',
    price_asc: 'price',
    price_desc: '-price',
    views: '-views',
  };
  const sort = SORTS[req.query.sort] || '-createdAt';

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  ok(res, { items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Products');
});

exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('createdBy', 'name email phone').lean();
  if (!product) return fail(res, 'Product not found', 404);

  // Engagement counts — additive only, the product object's own fields are
  // unchanged. Powers the Lead Count / Loan Requests / Interested
  // Customers stats the brief asks for on the Product Detail page.
  const [leadCount, loanCount, wishlistCount] = await Promise.all([
    Lead.countDocuments({ product: product._id }),
    LoanRequest.countDocuments({ product: product._id }),
    Wishlist.countDocuments({ product: product._id }),
  ]);

  ok(res, { ...product, leadCount, loanCount, wishlistCount }, 'Product');
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);

  for (const key of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) product[key] = req.body[key];
  }
  if (req.body.status && STATUSES.includes(req.body.status) && req.body.status !== product.status) {
    product.statusHistory.push({ status: req.body.status, at: new Date(), note: 'Updated by admin', by: req.user._id });
    product.status = req.body.status;
  }
  await product.save();
  ok(res, product, 'Product updated');
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return fail(res, 'Invalid status', 400);
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  product.status = status;
  product.statusHistory.push({ status, at: new Date(), note: 'Status changed by admin', by: req.user._id });
  await product.save();
  ok(res, product, 'Status updated');
});

exports.archive = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  product.status = 'archived';
  product.statusHistory.push({ status: 'archived', at: new Date(), note: 'Archived by admin', by: req.user._id });
  await product.save();
  ok(res, product, 'Product archived');
});

exports.remove = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return fail(res, 'Product not found', 404);
  ok(res, { id: req.params.id }, 'Product deleted');
});
