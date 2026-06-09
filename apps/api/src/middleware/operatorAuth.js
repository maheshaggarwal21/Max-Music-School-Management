'use strict';

const Operator = require('../models/Operator');
const { verify, COOKIE_NAME } = require('../config/jwt');
const { unauthorized } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// operatorAuth — verifies operator_token cookie.
// Requirements:
//   - cookie present + JWT valid
//   - token.panel === 'operator'
//   - token.twoFactorCompleted === true (no 2FA = no session)
//   - token.tokenVersion === operator.tokenVersion (server-side invalidation)
//   - operator exists
// On success: req.operator = the operator doc (lean).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function operatorAuth(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME.operator];
    if (!token) return unauthorized(res, S.AUTH_REQUIRED);

    let decoded;
    try {
      decoded = verify(token, 'operator');
    } catch {
      return unauthorized(res, S.AUTH_TOKEN_INVALID);
    }

    if (!decoded.twoFactorCompleted) {
      return unauthorized(res, S.AUTH_2FA_REQUIRED);
    }

    const operator = await Operator.findById(decoded.sub).lean();
    if (!operator) return unauthorized(res, S.AUTH_TOKEN_INVALID);

    if (decoded.tokenVersion !== operator.tokenVersion) {
      return unauthorized(res, S.AUTH_TOKEN_EXPIRED);
    }

    req.operator = {
      _id:   operator._id,
      name:  operator.name,
      email: operator.email,
      role:  'superadmin',
      tokenVersion: operator.tokenVersion,
    };
    next();
  } catch (err) {
    next(err);
  }
};
