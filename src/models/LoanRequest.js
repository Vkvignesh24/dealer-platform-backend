const mongoose = require('mongoose');

const LOAN_STATUSES = ['new', 'under_review', 'bank_shared', 'approved', 'rejected'];

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: LOAN_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

const loanRequestSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    occupation: { type: String, trim: true, maxlength: 100 },
    monthlySalary: { type: Number, min: 0 },
    downPayment: { type: Number, min: 0 },
    loanAmount: { type: Number, required: true, min: 0 },
    tenureMonths: { type: Number, min: 0 },
    remarks: { type: String, maxlength: 1000 },
    status: { type: String, enum: LOAN_STATUSES, default: 'new', index: true },
    dealerNote: { type: String, maxlength: 1000 },
    statusHistory: [statusHistorySchema],
    notes: [noteSchema],
  },
  { timestamps: true }
);

loanRequestSchema.index({ status: 1, createdAt: -1 });
loanRequestSchema.statics.STATUSES = LOAN_STATUSES;

module.exports = mongoose.model('LoanRequest', loanRequestSchema);
