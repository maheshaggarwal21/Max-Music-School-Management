'use strict';

const mongoose = require('mongoose');

const OperatorSchema = new mongoose.Schema(
  {
    name:              { type: String, required: true, trim: true },
    email:             { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Operator OTP login (single-step alternative to password — TOTP 2FA was
    // removed by user decision 2026-06-12). OTPs are sent only after the
    // mobile is verified via the settings flow.
    mobile:            { type: String, trim: true },
    mobileVerified:    { type: Boolean, default: false },
    passwordHash:      { type: String, required: true, select: false },
    role:              { type: String, enum: ['superadmin'], default: 'superadmin', required: true },
    tokenVersion:      { type: Number, default: 0 },
    lastLoginAt:       { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Operator', OperatorSchema);
