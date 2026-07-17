const mongoose = require('mongoose');

const NOTIFICATION_AUDIENCES = ['global', 'dealer', 'customer'];
const NOTIFICATION_TYPES = [
  'general', 'lead_created', 'lead_status_changed', 'loan_created', 'loan_approved',
  'loan_status_changed', 'sale_created', 'sale_reversed', 'product_reserved',
  'inventory_aging', 'customer_registered',
];

const notificationSchema = new mongoose.Schema(
  {
    audience: { type: String, enum: NOTIFICATION_AUDIENCES, default: 'global', index: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // optional specific user
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'general', index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // What this notification is about, for deep-linking from the bell menu.
    entityType: { type: String, default: null }, // 'product' | 'lead' | 'loan' | 'sale' | 'customer'
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ target: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.statics.AUDIENCES = NOTIFICATION_AUDIENCES;
notificationSchema.statics.TYPES = NOTIFICATION_TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
