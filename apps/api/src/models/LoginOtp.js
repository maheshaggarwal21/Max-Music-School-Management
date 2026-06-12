'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// One-time codes for OTP login and mobile verification.
//   • institutionId is null ONLY for operator OTPs (panel 'operator') — every
//     institution-panel lookup filters by institutionId (golden rule).
//   • otpHash is bcrypt (config/password) — the plaintext code is never stored.
//   • expiresAt drives a Mongo TTL index, so spent/expired codes self-delete.
//   • attempts caps brute force per code (config/otp enforces MAX_ATTEMPTS).
//   • consumedAt marks single-use; a consumed code never verifies again.
// ─────────────────────────────────────────────────────────────────────────────

const LoginOtpSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null, index: true },
    panel:         { type: String, enum: ['operator', 'admin', 'teacher', 'student'], required: true },
    userId:        { type: mongoose.Schema.Types.ObjectId, required: true },
    mobile:        { type: String, required: true, trim: true },
    purpose:       { type: String, enum: ['login', 'verify_mobile', 'reset_confirm'], required: true },
    otpHash:       { type: String, required: true, select: false },
    attempts:      { type: Number, default: 0 },
    consumedAt:    { type: Date, default: null },
    expiresAt:     { type: Date, required: true },
  },
  { timestamps: true }
);

// Self-clean expired codes (TTL fires at expiresAt).
LoginOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Verify path: latest pending code for this identity.
LoginOtpSchema.index({ institutionId: 1, panel: 1, mobile: 1, purpose: 1, createdAt: -1 });
// Send-cooldown path: recent codes per user+panel+purpose.
LoginOtpSchema.index({ userId: 1, panel: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model('LoginOtp', LoginOtpSchema);
