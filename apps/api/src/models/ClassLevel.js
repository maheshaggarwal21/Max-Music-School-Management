'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// A reusable "class level" template per institution: a total fee + a duration.
// Selecting one when enrolling pre-fills the student's feeTotal + validity days.
//   upcomingAmount — the total fee for the class (paise) → student.feeTotal
//   paidAmount     — default already-paid amount (paise, usually 0)
//   days           — validity duration in days (e.g. 90 for a 3-month class)
// Institution-scoped, admin-managed. Never hard-deleted (students reference it) —
// deactivate via isActive instead.
// ─────────────────────────────────────────────────────────────────────────────

const ClassLevelSchema = new mongoose.Schema(
  {
    institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name:           { type: String, required: true, trim: true },
    paidAmount:     { type: Number, default: 0, min: 0 }, // paise — default initial paid
    upcomingAmount: { type: Number, required: true, min: 0 }, // paise — total class fee
    days:           { type: Number, required: true, min: 1 },
    isActive:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

ClassLevelSchema.index({ institutionId: 1, name: 1 }, { unique: true });
ClassLevelSchema.index({ institutionId: 1, isActive: 1 });

module.exports = mongoose.model('ClassLevel', ClassLevelSchema);
