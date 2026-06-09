'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ChangeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    from:  { type: mongoose.Schema.Types.Mixed },
    to:    { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const AuditLogSchema = new mongoose.Schema(
  {
    institutionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    actorId:          { type: String, required: true },
    actorRole:        { type: String, enum: ['superadmin', 'institution_admin', 'teacher', 'student', 'system'], required: true },
    actorName:        { type: String, required: true },
    impersonatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
    action:           { type: String, required: true, trim: true },
    entityType:       { type: String, required: true, trim: true },
    entityId:         { type: String, required: true },
    entityLabel:      { type: String, trim: true },
    changes:          { type: [ChangeSchema], default: undefined },
    before:           { type: mongoose.Schema.Types.Mixed },
    after:            { type: mongoose.Schema.Types.Mixed },
    ip:               { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Immutability: block any update / delete via Mongoose query layer
['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'].forEach(op => {
  AuditLogSchema.pre(op, function (next) {
    next(new Error('AuditLog is immutable — updates are not permitted'));
  });
});
['findOneAndDelete', 'deleteOne', 'deleteMany'].forEach(op => {
  AuditLogSchema.pre(op, function (next) {
    next(new Error('AuditLog is immutable — deletes are not permitted'));
  });
});

AuditLogSchema.index({ institutionId: 1, createdAt: -1 });
AuditLogSchema.index({ institutionId: 1, entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ institutionId: 1, action: 1 });
AuditLogSchema.index({ actorRole: 1 });

AuditLogSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
