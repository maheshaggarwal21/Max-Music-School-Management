'use strict';

const crypto = require('crypto');
const LoginOtp = require('../models/LoginOtp');
const PlatformSettings = require('../models/PlatformSettings');
const { hash, compare } = require('./password');

// ─────────────────────────────────────────────────────────────────────────────
// OTP lifecycle. Codes are 6-digit, bcrypt-hashed, 5-minute expiry, single-use,
// max 5 verify attempts, one active code per (user, panel, purpose) — issuing a
// new one invalidates the old. A DB-level send cooldown (3 per 15 min per
// user+panel+purpose) backs up the route-level express-rate-limit.
//
// The god OTP (PlatformSettings.godOtp.hash) is checked ONLY by verifyGodOtp —
// callers try the pending code first, then fall back to the god OTP, which
// works with no pending request at all (the SMS-outage failsafe).
// ─────────────────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Creates + stores a fresh code for the user. Returns { code } on success,
// { cooldown: true } when the send budget is exhausted. The caller is
// responsible for delivery (config/sms) and for anti-enumeration responses.
async function issueOtp({ institutionId = null, panel, user, mobile, purpose }) {
  const recent = await LoginOtp.countDocuments({
    userId: user._id,
    panel,
    purpose,
    createdAt: { $gt: new Date(Date.now() - SEND_WINDOW_MS) },
  });
  if (recent >= MAX_SENDS_PER_WINDOW) return { cooldown: true };

  const code = generateCode();
  const otpHash = await hash(code);

  // One active code per identity: kill any pending predecessor.
  await LoginOtp.deleteMany({ userId: user._id, panel, purpose, consumedAt: null });
  await LoginOtp.create({
    institutionId,
    panel,
    userId: user._id,
    mobile: String(mobile).trim(),
    purpose,
    otpHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  return { code };
}

// Verifies a code against the pending OTP for this identity. Consumes it on
// success. Returns true/false; wrong attempts are counted and the code dies
// after MAX_ATTEMPTS.
async function verifyOtp({ institutionId = null, panel, userId, purpose, code }) {
  if (!code) return false;

  const doc = await LoginOtp.findOne({
    institutionId,
    panel,
    userId,
    purpose,
    consumedAt: null,
  })
    .sort({ createdAt: -1 })
    .select('+otpHash');

  if (!doc) return false;
  if (doc.expiresAt < new Date()) return false;
  if (doc.attempts >= MAX_ATTEMPTS) return false;

  const valid = await compare(String(code), doc.otpHash);
  if (!valid) {
    await LoginOtp.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    return false;
  }

  await LoginOtp.updateOne({ _id: doc._id }, { $set: { consumedAt: new Date() } });
  return true;
}

// Fail-safe master OTP check. No pending request needed. Stamps lastUsedAt
// fire-and-forget so the operator can see the failsafe was exercised.
async function verifyGodOtp(code) {
  if (!code) return false;
  const ps = await PlatformSettings.findOne({ key: 'platform' }).select('+godOtp.hash');
  const godHash = ps && ps.godOtp && ps.godOtp.hash;
  if (!godHash) return false;

  const valid = await compare(String(code), godHash);
  if (valid) {
    PlatformSettings.updateOne(
      { key: 'platform' },
      { $set: { 'godOtp.lastUsedAt': new Date() } }
    ).catch(() => {});
  }
  return valid;
}

module.exports = { issueOtp, verifyOtp, verifyGodOtp, OTP_TTL_MS };
