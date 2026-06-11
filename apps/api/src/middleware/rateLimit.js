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

function ipPlusIdentifierKey(req) {
  const ident = (req.body && (req.body.email || req.body.mobile)) || '';
  return `${req.ip}|${String(ident).toLowerCase()}`;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                  // 10 attempts per (IP, identifier) per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusIdentifierKey,
  handler: (req, res) => tooMany(res, S.AUTH_TOO_MANY),
});

// Stricter limiter for operator login (the platform's most privileged account).
const operatorLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipPlusIdentifierKey,
  handler: (req, res) => tooMany(res, S.AUTH_TOO_MANY),
});

// OTP request endpoints — stricter than login (each hit can fire an SMS).
// Backed up by the DB-level send cooldown in config/otp (3 per 15 min per user).
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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

module.exports = { loginLimiter, operatorLoginLimiter, otpRequestLimiter, apiLimiter };
