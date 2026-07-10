const mongoose = require('mongoose');

const LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'test_drive',
  'negotiation',
  'booked',
  'sold',
  'lost',
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: LEAD_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 1000 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    customerPhone: { type: String, required: true, trim: true, index: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    message: { type: String, maxlength: 1000 },
    response: { type: String, maxlength: 1000 },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    history: [statusHistorySchema],
    notes: [noteSchema],
  },
  { timestamps: true }
);

leadSchema.index({ customerPhone: 1, product: 1, createdAt: -1 });
leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
