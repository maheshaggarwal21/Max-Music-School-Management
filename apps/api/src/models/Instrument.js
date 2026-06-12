'use strict';

const mongoose = require('mongoose');

const InstrumentSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name:          { type: String, required: true, trim: true },
    isActive:      { type: Boolean, default: true },
    // True when this row was materialized from the operator's GLOBAL catalog
    // (PlatformSettings.instruments). Only these are auto-synced (reactivated /
    // deactivated) to mirror the catalog; institution-specific or seeded
    // instruments (fromCatalog:false) are left alone.
    fromCatalog:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

InstrumentSchema.index({ institutionId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Instrument', InstrumentSchema);
