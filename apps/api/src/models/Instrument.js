'use strict';

const mongoose = require('mongoose');

const InstrumentSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name:          { type: String, required: true, trim: true },
    isActive:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

InstrumentSchema.index({ institutionId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Instrument', InstrumentSchema);
