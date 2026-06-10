'use strict';

const Operator   = require('../../models/Operator');
const Instrument = require('../../models/Instrument');
const totp = require('../../config/totp');
const { ok, badRequest, notFound } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator settings. Profile + 2FA enrolment + per-institution instrument master.
// Operator profile/settings are PLATFORM-level (no institutionId) → NOT auditLog'd
// (auditLog requires an institutionId; it is for institution-scoped writes only).
// ─────────────────────────────────────────────────────────────────────────────

// Single settings payload shape consumed by the operator Settings page.
function settingsPayload(op) {
  return {
    profile: {
      _id:   String(op._id),
      name:  op.name,
      email: op.email,
      role:  'superadmin',
      lastLoginAt: op.lastLoginAt || null,
    },
    twoFactorEnabled: op.twoFactorEnabled,
    defaultRent: {
      amount:       (op.defaultRent && op.defaultRent.amount) || 2500000,
      billingCycle: (op.defaultRent && op.defaultRent.billingCycle) || 'monthly',
    },
    // No platform-level instrument master — instruments are per-institution.
  };
}

exports.getProfile = async (req, res, next) => {
  try {
    const op = await Operator.findById(req.operator._id).lean();
    if (!op) return notFound(res, S.NOT_FOUND);
    return ok(res, S.OK, settingsPayload(op));
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const body = req.body || {};
    // The settings page PATCHes { profile: { name, email }, defaultRent, … };
    // also accept the flat { name, email } shape.
    const { name, email } = body.profile || body;
    const { defaultRent } = body;

    const update = {};
    if (typeof name === 'string' && name.trim()) update.name = name.trim();
    if (typeof email === 'string' && email.trim()) update.email = email.toLowerCase().trim();
    if (defaultRent && Number.isFinite(defaultRent.amount) && defaultRent.amount > 0) {
      update['defaultRent.amount'] = Math.round(defaultRent.amount);
      update['defaultRent.billingCycle'] = 'monthly';
    }
    if (!Object.keys(update).length) return badRequest(res, S.VALIDATION_FAILED);

    try {
      await Operator.updateOne({ _id: req.operator._id }, { $set: update });
    } catch (e) {
      if (e && e.code === 11000) return badRequest(res, S.VALIDATION_FAILED); // dup email
      throw e;
    }

    const op = await Operator.findById(req.operator._id).lean();
    return ok(res, S.UPDATED, settingsPayload(op));
  } catch (err) {
    next(err);
  }
};

// 2FA is MANDATORY for operators. This endpoint (re)enrolls TOTP and returns a
// fresh QR; disabling is refused so an operator can never lock 2FA off.
exports.toggle2fa = async (req, res, next) => {
  try {
    const { action } = req.body || {};
    if (action === 'disable') return badRequest(res, S.OPERATOR_2FA_MANDATORY);
    if (action !== 'enable')  return badRequest(res, S.VALIDATION_FAILED);

    const op = await Operator.findById(req.operator._id);
    if (!op) return notFound(res, S.NOT_FOUND);

    const secret = totp.generateSecret();
    op.totpSecret       = secret;
    op.twoFactorEnabled = true;
    await op.save();

    const qr = await totp.qrDataUrl({ email: op.email, secret });
    // Plain secret returned ONCE for manual entry; never persisted in any log.
    return ok(res, S.OK, { twoFactor: { qrDataUrl: qr, secret } });
  } catch (err) {
    next(err);
  }
};

// ── Instrument master (per-institution; operator manages any via god-mode) ─────
exports.listInstruments = async (req, res, next) => {
  try {
    const { institutionId } = req.query;
    if (!institutionId) return badRequest(res, S.VALIDATION_FAILED);
    const items = await Instrument.find({ institutionId }).sort({ name: 1 }).lean();
    return ok(res, S.OK, {
      instruments: items.map(i => ({ _id: String(i._id), name: i.name, isActive: i.isActive })),
    });
  } catch (err) {
    next(err);
  }
};

exports.upsertInstrument = async (req, res, next) => {
  try {
    const { institutionId, instrumentId, name, isActive } = req.body || {};
    if (!institutionId || (!instrumentId && !name)) return badRequest(res, S.VALIDATION_FAILED);

    let doc;
    if (instrumentId) {
      doc = await Instrument.findOne({ _id: instrumentId, institutionId });
      if (!doc) return notFound(res, S.NOT_FOUND);
      if (typeof name === 'string' && name.trim()) doc.name = name.trim();
      if (typeof isActive === 'boolean') doc.isActive = isActive;
      await doc.save();
    } else {
      try {
        doc = await Instrument.create({ institutionId, name: String(name).trim(), isActive: isActive !== false });
      } catch (e) {
        if (e && e.code === 11000) return badRequest(res, S.VALIDATION_FAILED); // dup name in institution
        throw e;
      }
    }

    return ok(res, S.OK, { instrument: { _id: String(doc._id), name: doc.name, isActive: doc.isActive } });
  } catch (err) {
    next(err);
  }
};
