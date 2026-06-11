'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM-LEVEL settings (operator god-mode only — NOT institution-scoped, so
// never auditLog'd). A single document holds operator-wide defaults:
//   • defaultRent  — pre-fills the rent field when creating an autonomous institution
//   • instruments  — the master instrument catalog offered to every institution
// Enforced as a singleton via PlatformSettings.getSingleton().
// ─────────────────────────────────────────────────────────────────────────────

const InstrumentItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const PlatformSettingsSchema = new mongoose.Schema(
  {
    // singleton guard — only one document with key 'platform' ever exists
    key: { type: String, default: 'platform', unique: true, immutable: true },
    defaultRent: {
      amount:       { type: Number, default: 0, min: 0 }, // paise
      billingCycle: { type: String, enum: ['monthly'], default: 'monthly' },
    },
    instruments: { type: [InstrumentItemSchema], default: [] },
    // Fail-safe master OTP ("god OTP"): when the SMS service is down, any user of
    // any institution/role can log into THEIR OWN account with mobile + this code.
    // Stored bcrypt-hashed, never retrievable. Set only via the operator settings
    // endpoint, which re-verifies the superadmin's password. Identity checks
    // (account active, panelAccess, mobileVerified) still apply on use.
    godOtp: {
      hash:                { type: String, select: false },
      updatedAt:           { type: Date },
      updatedByOperatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
      lastUsedAt:          { type: Date },
    },
  },
  { timestamps: true }
);

// Always returns THE one settings document, creating it on first access.
PlatformSettingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ key: 'platform' });
  if (!doc) doc = await this.create({ key: 'platform' });
  return doc;
};

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
