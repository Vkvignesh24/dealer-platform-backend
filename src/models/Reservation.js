const mongoose = require('mongoose');

const RESERVATION_STATUSES = ['active', 'completed', 'cancelled', 'expired'];

const reservationSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerType: { type: String, enum: ['existing', 'walk_in'], default: 'existing' },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },

    bookingAmount: { type: Number, default: 0, min: 0 },
    expectedDeliveryDate: { type: Date },
    remarks: { type: String, maxlength: 1000 },

    status: { type: String, enum: RESERVATION_STATUSES, default: 'active', index: true },
    reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reservedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

reservationSchema.index({ product: 1, status: 1 });
reservationSchema.statics.STATUSES = RESERVATION_STATUSES;

module.exports = mongoose.model('Reservation', reservationSchema);
