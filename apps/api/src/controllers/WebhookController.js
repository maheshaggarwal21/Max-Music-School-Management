'use strict';

const mongoose = require('mongoose');
const Institution = require('../models/Institution');
const RazorpayWebhookEvent = require('../models/RazorpayWebhookEvent');
const { verifyWebhookSignature } = require('../config/razorpay');

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay webhook — PUBLIC (no panel cookie). Mounted BEFORE express.json() with
// a raw-body parser so the HMAC signature can be verified against the exact bytes
// Razorpay signed. Idempotent (deduped by paymentId+eventType). Writes ONLY the
// read-only RazorpayWebhookEvent reconciliation feed — never the Payment ledger.
//
// Institution attribution: per-teacher payment links should carry the tenant in
// Razorpay `notes` (institutionId or slug). Unattributed events are still stored
// (institutionId omitted) so the operator can reconcile them manually.
// ─────────────────────────────────────────────────────────────────────────────

function reply(res, code, message) {
  return res.status(code).json({ success: code < 400, message, data: null });
}

async function resolveInstitutionId(notes) {
  if (!notes || typeof notes !== 'object') return undefined;
  if (notes.institutionId && mongoose.isValidObjectId(notes.institutionId)) {
    const exists = await Institution.exists({ _id: notes.institutionId });
    if (exists) return notes.institutionId;
  }
  if (notes.slug) {
    const inst = await Institution.findOne({ slug: String(notes.slug).toLowerCase().trim() }).select('_id').lean();
    if (inst) return inst._id;
  }
  return undefined;
}

exports.razorpay = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const raw = req.body; // Buffer (express.raw)
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
      return reply(res, 400, 'Invalid signature');
    }

    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      return reply(res, 400, 'Invalid payload');
    }

    const eventType = body && body.event;
    if (!eventType) return reply(res, 400, 'Missing event');

    const entity =
      (body.payload && body.payload.payment && body.payload.payment.entity) ||
      (body.payload && body.payload.order && body.payload.order.entity) ||
      {};
    const paymentId = entity.id;
    const notes = entity.notes || {};

    // Idempotency — Razorpay retries until it gets a 2xx. A duplicate is success.
    if (paymentId) {
      const dup = await RazorpayWebhookEvent.findOne({ paymentId, eventType }).select('_id').lean();
      if (dup) return reply(res, 200, 'Already processed');
    }

    const institutionId = await resolveInstitutionId(notes);

    await RazorpayWebhookEvent.create({
      institutionId,
      eventType,
      paymentId,
      // Razorpay amounts are in the smallest currency unit (paise) — store rupees.
      amount: typeof entity.amount === 'number' ? entity.amount / 100 : undefined,
      contact: entity.contact || undefined,
      payerName: notes.name || entity.email || undefined,
      status: entity.status || undefined,
      rawPayload: body,
      receivedAt: new Date(),
    });

    return reply(res, 200, 'OK');
  } catch (err) {
    // Log but return 200 only AFTER a successful store; here the store failed, so
    // let Razorpay retry by returning 500.
    console.error('[webhook] razorpay handler failed', err.message);
    return reply(res, 500, 'Webhook processing failed');
  }
};
