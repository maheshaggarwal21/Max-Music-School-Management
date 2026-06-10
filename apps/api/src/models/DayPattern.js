'use strict';

const mongoose = require('mongoose');

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DayPatternSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    days:          { type: [{ type: String, enum: DAY_ENUM }], required: true, validate: v => Array.isArray(v) && v.length > 0 },
    // Canonical-ordered join of `days` ("mon-wed-fri") — scalar stand-in for the day SET,
    // because a unique index on the array field itself is multikey (per-element) and would
    // reject any two patterns that merely share one day.
    daysKey:       { type: String },
    label:         { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

const toDaysKey = days => [...days].sort((a, b) => DAY_ENUM.indexOf(a) - DAY_ENUM.indexOf(b)).join('-');

// Derive daysKey + display label "Mon-Wed-Fri" (save path)
DayPatternSchema.pre('validate', function (next) {
  if (Array.isArray(this.days) && this.days.length) {
    this.daysKey = toDaysKey(this.days);
    if (!this.label) {
      this.label = this.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('-');
    }
  }
  next();
});

// Re-derive daysKey + label when days are patched via findOneAndUpdate
DayPatternSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const days = (update.$set && update.$set.days) || update.days;
  if (Array.isArray(days) && days.length) {
    const label = days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('-');
    const daysKey = toDaysKey(days);
    if (update.$set) { update.$set.label = label; update.$set.daysKey = daysKey; }
    else { update.label = label; update.daysKey = daysKey; }
  }
  next();
});

DayPatternSchema.index({ institutionId: 1, isActive: 1 });
DayPatternSchema.index({ institutionId: 1, daysKey: 1 }, { unique: true });

module.exports = mongoose.model('DayPattern', DayPatternSchema);
