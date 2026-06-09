'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const RentInvoiceSchema = new mongoose.Schema(
  {
    institutionId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    period:               { type: String, required: true, trim: true },
    amount:               { type: Number, required: true, min: 0 },
    dueDate:              { type: Date, required: true },
    status:               { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending', required: true },
    paidAt:               { type: Date },
    reference:            { type: String, trim: true },
    markedByOperatorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Operator' },
  },
  { timestamps: true }
);

RentInvoiceSchema.index({ institutionId: 1, period: 1 }, { unique: true });
RentInvoiceSchema.index({ status: 1, dueDate: 1 });

RentInvoiceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('RentInvoice', RentInvoiceSchema);
