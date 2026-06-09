'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const RazorpayWebhookEventSchema = new mongoose.Schema(
  {
    institutionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
    eventType:      { type: String, required: true, trim: true },
    paymentId:      { type: String, trim: true },
    amount:         { type: Number },
    contact:        { type: String, trim: true },
    payerName:      { type: String, trim: true },
    status:         { type: String, trim: true },
    rawPayload:     { type: mongoose.Schema.Types.Mixed, required: true },
    receivedAt:     { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

RazorpayWebhookEventSchema.index({ paymentId: 1 }, { sparse: true });
RazorpayWebhookEventSchema.index({ receivedAt: -1 });
RazorpayWebhookEventSchema.index({ institutionId: 1, receivedAt: -1 });

RazorpayWebhookEventSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('RazorpayWebhookEvent', RazorpayWebhookEventSchema);
