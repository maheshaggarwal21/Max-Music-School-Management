'use strict';

const mongoose = require('mongoose');

const MarkedBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['superadmin', 'institution_admin', 'teacher', 'system'], required: true },
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    teacherId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    date:          { type: Date, required: true },
    status:        { type: String, enum: ['present', 'absent', 'holiday', 'credited'], required: true },
    markedBy:      { type: MarkedBySchema },
  },
  { timestamps: true }
);

AttendanceSchema.index({ institutionId: 1, batchId: 1, date: 1 });
AttendanceSchema.index({ institutionId: 1, studentId: 1, date: -1 });
AttendanceSchema.index({ studentId: 1, batchId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
