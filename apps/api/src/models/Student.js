'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const StudentSchema = new mongoose.Schema(
  {
    institutionId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    displayId:               { type: String, required: true, trim: true },
    teacherId:               { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    batchId:                 { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    name:                    { type: String, required: true, trim: true },
    mobile:                  { type: String, required: true, trim: true },
    // OTP login is allowed ONLY for verified mobiles; flipped by the self-serve
    // verify-mobile OTP flow, never by an admin edit.
    mobileVerified:          { type: Boolean, default: false },
    email:                   { type: String, lowercase: true, trim: true },
    guardianName:            { type: String, trim: true },
    guardianMobile:          { type: String, trim: true },
    gender:                  { type: String, enum: ['male', 'female'] },
    profilePicUrl:           { type: String, trim: true },
    instrumentId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument' },
    classType:               { type: String, trim: true },
    mode:                    { type: String, enum: ['online', 'offline'], default: 'online' },
    joinStatus:              { type: String, enum: ['trial', 'active_soon', 'active', 'inactive'], default: 'trial', required: true },
    sessionType:             { type: String, enum: ['live', 'all'], default: 'all' },
    category:                { type: String, enum: ['regular', 'trial'], default: 'regular' },
    validityStart:           { type: Date },
    validityEnd:             { type: Date },
    validityDays:            { type: Number, min: 0 },
    paidClasses:             { type: Number, default: 0, min: 0 },
    upcomingClasses:         { type: Number, default: 0, min: 0 },
    paidAmount:              { type: Number, default: 0, min: 0 },
    upcomingAmount:          { type: Number, default: 0, min: 0 },
    assignedVideoChapterId:  { type: mongoose.Schema.Types.ObjectId },
    requestId:               { type: mongoose.Schema.Types.ObjectId, ref: 'EnrollmentRequest' },
    recoveryOtp:             { type: String, select: false },
    passwordHash:            { type: String, select: false },
    tokenVersion:            { type: Number, default: 0 },
    status:                  { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
  },
  { timestamps: true }
);

StudentSchema.index({ institutionId: 1, createdAt: -1 });
StudentSchema.index({ institutionId: 1, status: 1 });
StudentSchema.index({ institutionId: 1, joinStatus: 1 });
StudentSchema.index({ institutionId: 1, teacherId: 1 });
StudentSchema.index({ institutionId: 1, batchId: 1 });
StudentSchema.index({ institutionId: 1, validityEnd: 1 });
StudentSchema.index({ institutionId: 1, displayId: 1 }, { unique: true });
StudentSchema.index({ institutionId: 1, mobile: 1 });
StudentSchema.index({ institutionId: 1, instrumentId: 1 });

StudentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Student', StudentSchema);
