'use strict';

const rateLimit = require('express-rate-limit');
const { tooMany } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Login rate limiting. Keyed by IP + identifier (email/mobile) so a brute force
// on one account doesn't burn the IP's budget for the whole institution.
//
// Note: cookie path-scoping is handled by config/jwt.cookieOptions(panel, slug),
// not here — middleware just enforces request budgets.
// ─────────────────────────────────────────────────────────────────────────────

const isProd = process.env.NODE_ENV === 'production';

function ipPlusIdentifierKey(req) {
  const ident = (req.body && (req.body.email || req.body.mobile)) || '';
  return `${req.ip}|${String(ident).toLowerCase()}`;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isProd ? 10 : 50,    // attempts per (IP, identifier) per window
  skipSuccessfulRequests: true, // only FAILED attempts count — a correct login never locks you out
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusIdentifierKey,
  handler: (req, res) => tooMany(res, S.AUTH_TOO_MANY),
});

// Stricter limiter for operator login (2FA-gated already, but defence-in-depth).
const operatorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 5 : 50,
  skipSuccessfulRequests: true, // the multi-step login (login → verify-2fa) must not self-trip on success
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusIdentifierKey,
  handler: (req, res) => tooMany(res, S.AUTH_TOO_MANY),
});

// Generic per-IP API limiter (mount at /api root; high ceiling so it only
// stops abuse, not normal traffic).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => tooMany(res, S.AUTH_TOO_MANY),
});

module.exports = { loginLimiter, operatorLoginLimiter, apiLimiter };
