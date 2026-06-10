'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const RequestedBySchema = new mongoose.Schema(
  {
    actorId:   { type: String, required: true },
    actorRole: { type: String, enum: ['institution_admin'], required: true },
    actorName: { type: String },
  },
  { _id: false }
);

// Institution admins cannot change their slug directly (it is immutable on the
// Institution schema — cookies and URLs are scoped to it). Instead they file a
// change request that the operator approves or rejects from the operator panel.
const SlugChangeRequestSchema = new mongoose.Schema(
  {
    institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    currentSlug:    { type: String, required: true, lowercase: true, trim: true },
    requestedSlug:  { type: String, required: true, lowercase: true, trim: true },
    reason:         { type: String, trim: true },
    status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
    requestedBy:    { type: RequestedBySchema, required: true },
    handledByOperatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    handledAt:      { type: Date },
    rejectionReason:{ type: String, trim: true },
  },
  { timestamps: true }
);

SlugChangeRequestSchema.index({ status: 1, createdAt: -1 });

SlugChangeRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SlugChangeRequest', SlugChangeRequestSchema);
