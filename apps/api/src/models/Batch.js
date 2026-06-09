'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const BatchSchema = new mongoose.Schema(
  {
    institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name:           { type: String, required: true, trim: true },
    instrumentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Instrument' },
    dayPatternId:   { type: mongoose.Schema.Types.ObjectId, ref: 'DayPattern' },
    timeSlotId:     { type: mongoose.Schema.Types.ObjectId, ref: 'TimeSlot' },
    teacherId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    mode:           { type: String, enum: ['online', 'offline'], default: 'online' },
    studentCount:   { type: Number, default: 0, min: 0 },
    status:         { type: String, enum: ['setting', 'active', 'inactive', 'archived'], default: 'setting', required: true },
  },
  { timestamps: true }
);

BatchSchema.index({ institutionId: 1, createdAt: -1 });
BatchSchema.index({ institutionId: 1, status: 1 });
BatchSchema.index({ institutionId: 1, teacherId: 1 });

BatchSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Batch', BatchSchema);
