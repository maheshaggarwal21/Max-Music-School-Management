'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const TeacherSchema = new mongoose.Schema(
  {
    institutionId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    displayId:            { type: String, required: true, trim: true },
    name:                 { type: String, required: true, trim: true },
    email:                { type: String, required: true, lowercase: true, trim: true },
    mobile:               { type: String, required: true, trim: true },
    altMobile:            { type: String, trim: true },
    gender:               { type: String, enum: ['male', 'female'] },
    dob:                  { type: Date },
    profilePicUrl:        { type: String, trim: true },
    razorpayPaymentLink:  { type: String, trim: true },
    isOwner:              { type: Boolean, default: false },
    panelAccess:          {
      type: [{ type: String, enum: ['teacher', 'admin'] }],
      default: ['teacher'],
      required: true,
    },
    employmentType:       { type: String, enum: ['salary', 'rent'] },
    salaryAmount:         { type: Number, min: 0 },
    performance:          { type: Number, min: 0, max: 100 },
    kpiPercent:           { type: Number, min: 0, max: 100 },
    passwordHash:         { type: String, required: true, select: false },
    recoveryOtp:          { type: String, select: false },
    tokenVersion:         { type: Number, default: 0 },
    status:               { type: String, enum: ['active', 'inactive'], default: 'active', required: true },
    lastLoginAt:          { type: Date },
  },
  { timestamps: true }
);

TeacherSchema.index({ institutionId: 1, createdAt: -1 });
TeacherSchema.index({ institutionId: 1, status: 1 });
TeacherSchema.index({ institutionId: 1, email: 1 }, { unique: true });
TeacherSchema.index({ institutionId: 1, displayId: 1 }, { unique: true });
TeacherSchema.index({ institutionId: 1, isOwner: 1 });
TeacherSchema.index({ institutionId: 1, mobile: 1 });
TeacherSchema.index({ institutionId: 1, employmentType: 1 });

TeacherSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Teacher', TeacherSchema);
