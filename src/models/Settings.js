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

    // Business Information
    business: {
      gstNumber: String,
      panNumber: String,
      registrationNumber: String,
    },

    // Contact Information (in addition to the primary phone/email above)
    contact: {
      alternatePhone: String,
      supportEmail: String,
    },

    // SEO
    seo: {
      metaTitle: String,
      metaDescription: String,
    },

    // Integrations — credentials are stored as configured/not-configured
    // flags plus the non-secret identifiers; actual API keys should live
    // in environment variables, never in this document.
    integrations: {
      whatsappApi: {
        enabled: { type: Boolean, default: false },
        phoneNumberId: String,
      },
      razorpay: {
        enabled: { type: Boolean, default: false },
        keyId: String,
      },
      googleAnalytics: {
        enabled: { type: Boolean, default: false },
        measurementId: String,
      },
    },

    // Branding
    branding: {
      favicon: String,
      splashLogo: String,
      appLogo: String,
      appIcon: String,
    },
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
