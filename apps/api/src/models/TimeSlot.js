'use strict';

const mongoose = require('mongoose');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const TimeSlotSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    startTime:     { type: String, required: true, match: HHMM },
    endTime:       { type: String, required: true, match: HHMM },
    label:         { type: String, trim: true },
    isOnline:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Derive label on save path
TimeSlotSchema.pre('validate', function (next) {
  if (!this.label && this.startTime && this.endTime) {
    this.label = `${this.startTime} - ${this.endTime}`;
  }
  next();
});

// Re-derive label when times are patched via findOneAndUpdate
TimeSlotSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const startTime = (update.$set && update.$set.startTime) || update.startTime;
  const endTime   = (update.$set && update.$set.endTime)   || update.endTime;
  if (startTime || endTime) {
    const label = `${startTime || '??:??'} - ${endTime || '??:??'}`;
    if (update.$set) update.$set.label = label;
    else update.label = label;
  }
  next();
});

TimeSlotSchema.index({ institutionId: 1, isOnline: 1 });
TimeSlotSchema.index({ institutionId: 1, startTime: 1, endTime: 1 }, { unique: true });

module.exports = mongoose.model('TimeSlot', TimeSlotSchema);
