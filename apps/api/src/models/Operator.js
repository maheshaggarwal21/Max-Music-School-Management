'use strict';

const mongoose = require('mongoose');

const OperatorSchema = new mongoose.Schema(
  {
    name:              { type: String, required: true, trim: true },
    email:             { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:      { type: String, required: true, select: false },
    role:              { type: String, enum: ['superadmin'], default: 'superadmin', required: true },
    totpSecret:        { type: String, select: false },
    pendingTotpSecret: { type: String, select: false }, // held during (re)enrollment until a code is verified
    twoFactorEnabled:  { type: Boolean, default: true },
    tokenVersion:      { type: Number, default: 0 },
    lastLoginAt:       { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Operator', OperatorSchema);
