'use strict';

const mongoose = require('mongoose');

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DayPatternSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    days:          { type: [{ type: String, enum: DAY_ENUM }], required: true, validate: v => Array.isArray(v) && v.length > 0 },
    // Canonical scalar key (days sorted into week order, joined) — used for the
    // uniqueness constraint. A unique index on the `days` ARRAY is MULTIKEY and
    // would forbid any two patterns from sharing a single day; dayKey enforces
    // "same exact SET of days" instead, which is the real intent.
    dayKey:        { type: String },
    label:         { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Derive display label "Mon-Wed-Fri" + the canonical dayKey (save path)
DayPatternSchema.pre('validate', function (next) {
  if (Array.isArray(this.days) && this.days.length) {
    const ordered = [...this.days].sort((a, b) => DAY_ENUM.indexOf(a) - DAY_ENUM.indexOf(b));
    if (!this.label) this.label = ordered.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('-');
    this.dayKey = ordered.join('-');
  }
  next();
});

// Re-derive label when days are patched via findOneAndUpdate
DayPatternSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const days = (update.$set && update.$set.days) || update.days;
  if (Array.isArray(days) && days.length) {
    const label = days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('-');
    if (update.$set) update.$set.label = label;
    else update.label = label;
  }
  next();
});

DayPatternSchema.index({ institutionId: 1, isActive: 1 });
// Uniqueness on the canonical scalar key — NOT the multikey `days` array.
DayPatternSchema.index({ institutionId: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('DayPattern', DayPatternSchema);
