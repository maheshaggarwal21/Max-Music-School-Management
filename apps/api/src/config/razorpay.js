'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Razorpay client + webhook signature verification.
// The app TRACKS money, it does not ROUTE it: webhooks feed the read-only
// RazorpayWebhookEvent reconciliation list, never the authoritative Payment ledger.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const Razorpay = require('razorpay');

let client = null;

// Lazy client — only built when keys are configured. Returns null otherwise so
// callers can degrade gracefully in dev.
function getClient() {
  if (client) return client;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  client = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return client;
}

// Verify the X-Razorpay-Signature header against the RAW request body using the
// webhook secret. Timing-safe. Fails CLOSED: returns false if the secret is not
// configured or the signature is missing/malformed.
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[razorpay] RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
    return false;
  }
  if (!rawBody || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { getClient, verifyWebhookSignature };
