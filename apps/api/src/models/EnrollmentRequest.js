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

// Proposed student config carried by the admin "Add Student" big form. The
// request is reviewed in New Requests, then approve() consumes these as DEFAULTS
// (the approval form overrides). All optional → a minimal lead request omits it.
const ProposedSchema = new mongoose.Schema(
  {
    classLevelId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ClassLevel' },
    teacherId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    batchId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    instrumentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument' },
    classType:       { type: String, trim: true },
    mode:            { type: String, enum: ['online', 'offline'] },
    sessionType:     { type: String, enum: ['live', 'all'] },
    joinStatus:      { type: String, enum: ['trial', 'active_soon', 'active', 'inactive'] },
    category:        { type: String, enum: ['regular', 'trial'] },
    gender:          { type: String, enum: ['male', 'female'] },
    validityStart:   { type: Date },
    validityEnd:     { type: Date },
    validityDays:    { type: Number, min: 0 },
    feeTotal:        { type: Number, min: 0 },   // paise
    paidAmount:      { type: Number, min: 0 },   // paise
    paidClasses:     { type: Number, min: 0 },
    upcomingClasses: { type: Number, min: 0 },
    remarks:         { type: String, trim: true },
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
    proposed:               { type: ProposedSchema },
  },
  { timestamps: true }
);

EnrollmentRequestSchema.index({ institutionId: 1, createdAt: -1 });
EnrollmentRequestSchema.index({ institutionId: 1, status: 1 });

EnrollmentRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('EnrollmentRequest', EnrollmentRequestSchema);
