'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const HandledBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['superadmin', 'institution_admin', 'teacher'], required: true },
  },
  { _id: false }
);

const EnrollmentRequestSchema = new mongoose.Schema(
  {
    institutionId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name:                   { type: String, required: true, trim: true },
    mobile:                 { type: String, required: true, trim: true },
    email:                  { type: String, lowercase: true, trim: true },
    preferredDayPatternId:  { type: mongoose.Schema.Types.ObjectId, ref: 'DayPattern' },
    preferredTimeSlotId:    { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' },
    instrumentId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument' },
    status:                 { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
    paymentStatus:          { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    approvedStudentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    handledBy:              { type: HandledBySchema },
    handledAt:              { type: Date },
    rejectionReason:        { type: String, trim: true },
  },
  { timestamps: true }
);

EnrollmentRequestSchema.index({ institutionId: 1, createdAt: -1 });
EnrollmentRequestSchema.index({ institutionId: 1, status: 1 });

EnrollmentRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('EnrollmentRequest', EnrollmentRequestSchema);
