'use strict';

const Operator = require('../../models/Operator');
const totp = require('../../config/totp');
const { compare } = require('../../config/password');
const {
  sign, signChallengeToken, verifyChallengeToken, COOKIE_NAME, cookieOptions,
} = require('../../config/jwt');
const { ok, badRequest, unauthorized } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator auth — TWO STEP, 2FA mandatory.
//   1. login(email,password) → challengeToken (NO session cookie yet)
//   2. verify-2fa(challengeToken, code) → operator_token cookie
// Same generic "Invalid credentials" for unknown email AND wrong password —
// never reveal which operators exist.
// ─────────────────────────────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return badRequest(res, S.VALIDATION_FAILED);

    const operator = await Operator
      .findOne({ email: String(email).toLowerCase().trim() })
      .select('+passwordHash');

    // Always run compare to blunt user-enumeration timing.
    const hash = operator ? operator.passwordHash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const valid = await compare(password, hash);
    if (!operator || !valid) return unauthorized(res, S.AUTH_INVALID);

    // 2FA is non-negotiable for operator.
    const challengeToken = signChallengeToken({ operatorId: operator._id });
    return ok(res, S.AUTH_2FA_REQUIRED, { twoFactorRequired: true, challengeToken });
  } catch (err) {
    next(err);
  }
};

exports.verify2fa = async (req, res, next) => {
  try {
    const { challengeToken, code } = req.body || {};
    if (!challengeToken || !code) return badRequest(res, S.VALIDATION_FAILED);

    let payload;
    try {
      payload = verifyChallengeToken(challengeToken);
    } catch {
      return unauthorized(res, S.AUTH_TOKEN_INVALID);
    }

    const operator = await Operator.findById(payload.operatorId).select('+totpSecret');
    if (!operator || !operator.totpSecret) return unauthorized(res, S.AUTH_2FA_INVALID);

    if (!totp.verify(code, operator.totpSecret)) return unauthorized(res, S.AUTH_2FA_INVALID);

    const token = sign(
      { sub: String(operator._id), tokenVersion: operator.tokenVersion, twoFactorCompleted: true },
      'operator'
    );
    res.cookie(COOKIE_NAME.operator, token, cookieOptions('operator'));

    await Operator.updateOne({ _id: operator._id }, { $set: { lastLoginAt: new Date() } });

    return ok(res, S.OK, {
      operator: {
        _id:   String(operator._id),
        name:  operator.name,
        email: operator.email,
        role:  'superadmin',
      },
    });
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
  return ok(res, S.OK, {
    operator: {
      _id:   String(req.operator._id),
      name:  req.operator.name,
      email: req.operator.email,
      role:  'superadmin',
    },
  });
};
