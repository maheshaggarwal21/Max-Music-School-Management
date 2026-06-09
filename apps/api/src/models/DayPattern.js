'use strict';

const mongoose = require('mongoose');

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DayPatternSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    days:          { type: [{ type: String, enum: DAY_ENUM }], required: true, validate: v => Array.isArray(v) && v.length > 0 },
    label:         { type: String, trim: true },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Derive display label "Mon-Wed-Fri" if absent (save path)
DayPatternSchema.pre('validate', function (next) {
  if (!this.label && Array.isArray(this.days) && this.days.length) {
    this.label = this.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join('-');
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
DayPatternSchema.index({ institutionId: 1, days: 1 }, { unique: true });

module.exports = mongoose.model('DayPattern', DayPatternSchema);
