'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const LaunchedBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['superadmin', 'institution_admin', 'teacher'], required: true },
  },
  { _id: false }
);

// A launched class session for a batch (zoom/meet link + the date it targets).
// Powers the batch Overview tab: "Launch Session" + the session archive.
const ClassSessionSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    meetingUrl:    { type: String, required: true, trim: true },
    targetDate:    { type: Date, required: true },
    launchedBy:    { type: LaunchedBySchema },
  },
  { timestamps: true }
);

ClassSessionSchema.index({ institutionId: 1, batchId: 1, targetDate: -1 });

ClassSessionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ClassSession', ClassSessionSchema);
