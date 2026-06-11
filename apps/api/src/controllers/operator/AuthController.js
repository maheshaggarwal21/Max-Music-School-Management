'use strict';

const Operator = require('../../models/Operator');
const { compare } = require('../../config/password');
const { issueOtp, verifyOtp, verifyGodOtp } = require('../../config/otp');
const { sendOtpSms } = require('../../config/sms');
const { sign, COOKIE_NAME, cookieOptions } = require('../../config/jwt');
const { ok, badRequest, unauthorized } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator auth — single step, two alternatives (user decision 2026-06-12,
// TOTP 2FA removed):
//   • email + password            → operator_token cookie
//   • mobile OTP (MSG91 delivery) → operator_token cookie
// OTPs go only to the operator's VERIFIED mobile; the platform god OTP is
// accepted in place of a delivered code (SMS-outage failsafe) — identity
// checks still apply. Generic "Invalid credentials" everywhere — never reveal
// which operators exist.
// ─────────────────────────────────────────────────────────────────────────────

const DUMMY_HASH = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';

function issueOperatorSession(res, operator) {
  const token = sign(
    { sub: String(operator._id), tokenVersion: operator.tokenVersion },
    'operator'
  );
  res.cookie(COOKIE_NAME.operator, token, cookieOptions('operator'));
}

function operatorPayload(operator) {
  return {
    _id:   String(operator._id),
    name:  operator.name,
    email: operator.email,
    role:  'superadmin',
  };
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return badRequest(res, S.VALIDATION_FAILED);

    const operator = await Operator
      .findOne({ email: String(email).toLowerCase().trim() })
      .select('+passwordHash');

    // Always run compare to blunt user-enumeration timing.
    const valid = await compare(password, operator ? operator.passwordHash : DUMMY_HASH);
    if (!operator || !valid) return unauthorized(res, S.AUTH_INVALID);

    issueOperatorSession(res, operator);
    await Operator.updateOne({ _id: operator._id }, { $set: { lastLoginAt: new Date() } });

    return ok(res, S.OK, { operator: operatorPayload(operator) });
  } catch (err) {
    next(err);
  }
};

// ── OTP login (alternative to password) ──────────────────────────────────────
// Request always answers the same generic OK (anti-enumeration); codes are sent
// only to a verified operator mobile.

exports.otpRequest = async (req, res, next) => {
  try {
    const mobile = String((req.body && req.body.mobile) || '').trim();
    if (!mobile) return badRequest(res, S.VALIDATION_FAILED);

    const operator = await Operator.findOne({ mobile });
    if (operator && operator.mobileVerified) {
      const { code, cooldown } = await issueOtp({
        institutionId: null, panel: 'operator', user: operator, mobile, purpose: 'login',
      });
      if (!cooldown) await sendOtpSms({ mobile, otp: code });
    }

    return ok(res, S.OTP_SENT_GENERIC, null);
  } catch (err) {
    next(err);
  }
};

exports.otpVerify = async (req, res, next) => {
  try {
    const mobile = String((req.body && req.body.mobile) || '').trim();
    const code = String((req.body && req.body.otp) || '').trim();
    if (!mobile || !code) return badRequest(res, S.VALIDATION_FAILED);

    const operator = await Operator.findOne({ mobile });
    if (!operator || !operator.mobileVerified) return unauthorized(res, S.AUTH_INVALID);

    const otpValid = await verifyOtp({
      institutionId: null, panel: 'operator', userId: operator._id, purpose: 'login', code,
    });
    if (!otpValid && !(await verifyGodOtp(code))) {
      return unauthorized(res, S.OTP_INVALID);
    }

    issueOperatorSession(res, operator);
    await Operator.updateOne({ _id: operator._id }, { $set: { lastLoginAt: new Date() } });

    return ok(res, S.OK, { operator: operatorPayload(operator) });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME.operator, cookieOptions('operator'));
  return ok(res, S.AUTH_LOGGED_OUT, null);
};

exports.me = (req, res) => {
  // operatorAuth has set req.operator
  return ok(res, S.OK, { operator: operatorPayload(req.operator) });
};
