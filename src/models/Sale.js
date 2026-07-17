const mongoose = require('mongoose');

const PAYMENT_METHODS = ['cash', 'loan', 'mixed'];
const SALE_STATUSES = ['active', 'reversed', 'cancelled', 'refunded'];
const REVERSE_REASONS = ['customer_cancelled', 'loan_rejected', 'wrong_entry', 'duplicate_entry', 'other'];

const saleSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerType: { type: String, enum: ['existing', 'walk_in'], default: 'existing' },

    // Optional links — a sale does not have to originate from a lead/loan,
    // and the lead's interested product can differ from the product sold.
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanRequest', default: null },
    reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },

    // Snapshot of what the lead/loan status was immediately before this
    // sale touched them, so a reversal can restore it exactly rather than
    // guessing a generic fallback status.
    previousLeadStatus: { type: String, default: null },
    previousLoanStatus: { type: String, default: null },

    salePrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    bookingAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    loanUsed: { type: Boolean, default: false },
    remarks: { type: String, maxlength: 1000 },

    soldDate: { type: Date, default: Date.now },
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Lifecycle — a sale is never deleted. Reversing it creates an
    // auditable record instead of erasing sale history.
    status: { type: String, enum: SALE_STATUSES, default: 'active', index: true },
    reverseReason: { type: String, enum: REVERSE_REASONS, default: null },
    reverseNote: { type: String, maxlength: 500 },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// A product may accumulate many Sale documents over time (sold, reversed,
// sold again to someone else...) but can only have ONE active sale at a
// time. A plain unique index on `product` would reject that second sale —
// this partial index only enforces uniqueness among active sales.
// A plain index for "every sale this product has ever had" lookups
// (Product Detail's Sale History card) — the partial unique index above
// only covers active sales.
saleSchema.index({ product: 1, soldDate: -1 });
saleSchema.index({ product: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
saleSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
saleSchema.statics.STATUSES = SALE_STATUSES;
saleSchema.statics.REVERSE_REASONS = REVERSE_REASONS;

module.exports = mongoose.model('Sale', saleSchema);
