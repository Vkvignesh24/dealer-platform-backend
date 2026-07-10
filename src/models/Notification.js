const mongoose = require('mongoose');

const NOTIFICATION_AUDIENCES = ['global', 'dealer', 'customer'];

const notificationSchema = new mongoose.Schema(
  {
    audience: { type: String, enum: NOTIFICATION_AUDIENCES, default: 'global', index: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // optional specific user
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.statics.AUDIENCES = NOTIFICATION_AUDIENCES;

module.exports = mongoose.model('Notification', notificationSchema);
