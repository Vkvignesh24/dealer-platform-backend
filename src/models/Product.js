const mongoose = require('mongoose');

const PRODUCT_STATUSES = ['available', 'reserved', 'sold', 'archived'];
const PRODUCT_CATEGORIES = ['car', 'bike', 'land', 'property', 'commercial', 'ev'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: PRODUCT_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, lowercase: true, index: true },
    subcategory: { type: String, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    brand: { type: String, trim: true, index: true },
    model: { type: String, trim: true },
    variant: { type: String, trim: true },
    price: { type: Number, required: true, min: 0, index: true },
    year: { type: Number, min: 1900, max: 2100 },
    description: { type: String, maxlength: 4000 },
    specifications: { type: Map, of: String, default: {} },
    features: [String],
    images: [{ type: String }],
    video: String,
    location: { type: String, index: true },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: 'available',
      index: true,
    },
    statusHistory: [statusHistorySchema],
    featured: { type: Boolean, default: false, index: true },
    views: { type: Number, default: 0 },
    // Lowercased & collapsed copy of name+brand+model for forgiving search
    searchKey: { type: String, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // Denormalized pointers for fast list/detail rendering. Sale and
    // Reservation documents remain the source of truth — these fields are
    // written only by saleController/reservationController and are cleared
    // when a sale/reservation is reversed.
    activeSale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    activeReservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, featured: -1, createdAt: -1 });
productSchema.index({ status: 1, category: 1, price: 1 });
productSchema.index(
  { name: 'text', brand: 'text', model: 'text', category: 'text', description: 'text' },
  { weights: { name: 5, brand: 4, model: 3, category: 2, description: 1 } }
);

productSchema.pre('save', function (next) {
  const parts = [this.name, this.brand, this.model, this.variant]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  this.searchKey = parts;
  next();
});

productSchema.statics.STATUSES = PRODUCT_STATUSES;
productSchema.statics.CATEGORIES = PRODUCT_CATEGORIES;

module.exports = mongoose.model('Product', productSchema);
