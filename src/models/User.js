const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, index: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, index: true },
    avatar: String,
    role: {
      type: String,
      enum: ['customer', 'dealer', 'admin'],
      default: 'customer',
      index: true,
    },
    active: { type: Boolean, default: true },

    // Snapshot list kept in sync by saleController; Sale collection remains
    // the source of truth for reporting/analytics.
    purchaseHistory: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
        salePrice: Number,
        soldDate: Date,
        // 'active' = customer currently owns this purchase. 'cancelled' =
        // the underlying sale was reversed — kept for history, but hidden
        // from the customer's "my purchases" view.
        status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
      },
    ],
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
