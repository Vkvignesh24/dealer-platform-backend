const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: 'InventoryHub' },
    logo: String,
    phone: String,
    whatsapp: String,
    email: String,
    address: String,
    social: {
      facebook: String,
      instagram: String,
      youtube: String,
      website: String,
    },
    primaryColor: { type: String, default: '#0F1B2D' },
  },
  { timestamps: true }
);

// Always one settings document.
settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
