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
// TTL: auto-expire raw reconciliation events after 12 months (T-001). The
// authoritative money ledger lives in the Payment model and is NOT expired —
// only this raw webhook feed. A single ascending TTL index also serves the
// receivedAt sort (Mongo scans it in reverse for descending order).
RazorpayWebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });
RazorpayWebhookEventSchema.index({ institutionId: 1, receivedAt: -1 });

RazorpayWebhookEventSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('RazorpayWebhookEvent', RazorpayWebhookEventSchema);
