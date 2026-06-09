'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const RecordedBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['superadmin', 'institution_admin', 'teacher', 'system'], required: true },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    institutionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    studentId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    teacherId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    type:               { type: String, enum: ['fee', 'admission'], required: true },
    period:             { type: String, trim: true },
    amount:             { type: Number, required: true, min: 0 },
    status:             { type: String, enum: ['paid', 'overdue', 'partial', 'free'], required: true },
    method:             { type: String, enum: ['razorpay', 'manual', 'cash'], default: 'manual' },
    razorpayPaymentId:  { type: String, trim: true },
    paidAt:             { type: Date },
    recordedBy:         { type: RecordedBySchema },
  },
  { timestamps: true }
);

PaymentSchema.index({ institutionId: 1, createdAt: -1 });
PaymentSchema.index({ institutionId: 1, status: 1 });
PaymentSchema.index({ institutionId: 1, studentId: 1 });
PaymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });

PaymentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Payment', PaymentSchema);
