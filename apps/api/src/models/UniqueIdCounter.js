'use strict';

const mongoose = require('mongoose');

const UniqueIdCounterSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    entityType:    { type: String, enum: ['student', 'teacher'], required: true },
    seq:           { type: Number, default: 0 },
    start:         { type: Number },
  },
  { timestamps: true }
);

UniqueIdCounterSchema.index({ institutionId: 1, entityType: 1 }, { unique: true });

module.exports = mongoose.model('UniqueIdCounter', UniqueIdCounterSchema);
