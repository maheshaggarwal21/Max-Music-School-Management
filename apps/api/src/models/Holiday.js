'use strict';

const mongoose = require('mongoose');

const CreatedBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['superadmin', 'institution_admin', 'teacher'], required: true },
  },
  { _id: false }
);

const HolidaySchema = new mongoose.Schema(
  {
    institutionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    batchId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    date:             { type: Date, required: true },
    studentCategory:  { type: String, enum: ['regular', 'trial'], required: true },
    reason:           { type: String, trim: true },
    creditsApplied:   { type: Boolean, default: false },
    createdBy:        { type: CreatedBySchema },
  },
  { timestamps: true }
);

HolidaySchema.index({ institutionId: 1, batchId: 1, date: 1 });
HolidaySchema.index({ institutionId: 1, date: 1 });

module.exports = mongoose.model('Holiday', HolidaySchema);
