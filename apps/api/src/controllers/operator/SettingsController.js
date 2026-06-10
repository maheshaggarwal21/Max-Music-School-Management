'use strict';

const Operator         = require('../../models/Operator');
const Instrument       = require('../../models/Instrument');
const PlatformSettings = require('../../models/PlatformSettings');
const totp = require('../../config/totp');
const { ok, badRequest, notFound } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator settings. Profile + 2FA enrolment + platform defaults (default rent,
// instrument master catalog). All PLATFORM-level (no institutionId) → NOT
// auditLog'd (auditLog requires an institutionId; it is for institution-scoped
// writes only). The per-institution instrument endpoints live further below.
// ─────────────────────────────────────────────────────────────────────────────

function serializeSettings(op, ps) {
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
      amount:       ps.defaultRent ? ps.defaultRent.amount : 0,
      billingCycle: ps.defaultRent ? ps.defaultRent.billingCycle : 'monthly',
    },
    instruments: (ps.instruments || []).map(i => ({
      _id: String(i._id), name: i.name, isActive: i.isActive,
    })),
  };
}

exports.getSettings = async (req, res, next) => {
  try {
    const [op, ps] = await Promise.all([
      Operator.findById(req.operator._id).lean(),
      PlatformSettings.getSingleton(),
    ]);
    if (!op) return notFound(res, S.NOT_FOUND);
    return ok(res, S.OK, serializeSettings(op, ps));
  } catch (err) {
    next(err);
  }
};

// Accepts a partial settings object: { profile?, defaultRent?, instruments? }.
exports.updateSettings = async (req, res, next) => {
  try {
    const { profile, defaultRent, instruments } = req.body || {};

    // ── operator profile ──
    if (profile && typeof profile === 'object') {
      const update = {};
      if (typeof profile.name === 'string' && profile.name.trim()) update.name = profile.name.trim();
      if (typeof profile.email === 'string' && profile.email.trim()) update.email = profile.email.toLowerCase().trim();
      if (Object.keys(update).length) {
        try {
          await Operator.updateOne({ _id: req.operator._id }, { $set: update });
        } catch (e) {
          if (e && e.code === 11000) return badRequest(res, S.VALIDATION_FAILED); // dup email
          throw e;
        }
      }
    }

    // ── platform defaults (rent + instrument catalog) ──
    const ps = await PlatformSettings.getSingleton();
    if (defaultRent && typeof defaultRent === 'object') {
      if (defaultRent.amount !== undefined) {
        const n = Number(defaultRent.amount);
        if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
        ps.defaultRent.amount = n;
      }
      // billingCycle is fixed to 'monthly' by the schema enum
    }
    if (Array.isArray(instruments)) {
      // full replace — names are unique (case-insensitive), blanks dropped
      const seen = new Set();
      ps.instruments = instruments
        .filter(i => i && typeof i.name === 'string' && i.name.trim())
        .filter(i => {
          const k = i.name.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map(i => ({ name: i.name.trim(), isActive: i.isActive !== false }));
    }
    await ps.save();

    const op = await Operator.findById(req.operator._id).lean();
    return ok(res, S.UPDATED, serializeSettings(op, ps));
  } catch (err) {
    next(err);
  }
};

// ── 2FA enrolment (mandatory for operators) ────────────────────────────────────
// enable → mints a fresh secret held as PENDING (not yet active) and returns it
// for the authenticator app. verify → confirms a code, promotes pending→active.
// disable → refused: an operator can never lock 2FA off.
exports.enable2fa = async (req, res, next) => {
  try {
    const op = await Operator.findById(req.operator._id).select('+pendingTotpSecret');
    if (!op) return notFound(res, S.NOT_FOUND);

    const secret = totp.generateSecret();
    op.pendingTotpSecret = secret;
    await op.save();

    const otpauthUrl = totp.otpauthUrl({ email: op.email, secret });
    // Plain secret returned ONCE for manual entry; never persisted in any log.
    return ok(res, S.OK, { otpauthUrl, secret });
  } catch (err) {
    next(err);
  }
};

exports.verify2fa = async (req, res, next) => {
  try {
    const { code } = req.body || {};
    const op = await Operator.findById(req.operator._id).select('+pendingTotpSecret +totpSecret');
    if (!op) return notFound(res, S.NOT_FOUND);
    if (!op.pendingTotpSecret) return badRequest(res, S.VALIDATION_FAILED);
    if (!totp.verify(code, op.pendingTotpSecret)) return badRequest(res, S.AUTH_2FA_INVALID);

    op.totpSecret        = op.pendingTotpSecret;
    op.pendingTotpSecret = undefined;
    op.twoFactorEnabled  = true;
    await op.save();

    return ok(res, S.OK, { twoFactorEnabled: true });
  } catch (err) {
    next(err);
  }
};

exports.disable2fa = async (req, res, next) => {
  // Security invariant: 2FA is mandatory for operators — disabling is never allowed.
  return badRequest(res, S.OPERATOR_2FA_MANDATORY);
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
