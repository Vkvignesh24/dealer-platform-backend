const mongoose = require('mongoose');

const ACTIONS = [
  'product_created', 'product_updated', 'lead_updated', 'loan_updated',
  'sale_created', 'sale_reversed',
];

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ACTIONS, required: true, index: true },
    entityType: { type: String, required: true }, // 'product' | 'lead' | 'loan' | 'sale'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    entityLabel: { type: String }, // human-readable snapshot, e.g. product name
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.statics.ACTIONS = ACTIONS;

module.exports = mongoose.model('AuditLog', auditLogSchema);
