'use strict';

// Platform-level webhooks (no panel cookie). Razorpay calls a single URL; the
// tenant is recovered from the payload `notes`. Mounted in server.js BEFORE the
// global JSON parser with a raw-body parser so HMAC verification sees exact bytes.
const router = require('express').Router();
const Webhook = require('../controllers/WebhookController');

router.post('/razorpay', Webhook.razorpay);

module.exports = router;
