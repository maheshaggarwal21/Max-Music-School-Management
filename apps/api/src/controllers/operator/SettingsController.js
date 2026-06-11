'use strict';

const Operator         = require('../../models/Operator');
const Instrument       = require('../../models/Instrument');
const PlatformSettings = require('../../models/PlatformSettings');
const { hash, compare } = require('../../config/password');
const { issueOtp, verifyOtp } = require('../../config/otp');
const { sendOtpSms } = require('../../config/sms');
const { ok, badRequest, notFound, unauthorized } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator settings. Profile + platform defaults (default rent, instrument
// master catalog) + fail-safe god OTP + operator mobile (for OTP login).
// All PLATFORM-level (no institutionId) → NOT
// auditLog'd (auditLog requires an institutionId; it is for institution-scoped
// writes only). The per-institution instrument endpoints live further below.
// ─────────────────────────────────────────────────────────────────────────────

function serializeSettings(op, ps) {
  return {
    profile: {
      _id:   String(op._id),
      name:  op.name,
      email: op.email,
      mobile:         op.mobile || null,
      mobileVerified: !!op.mobileVerified,
      role:  'superadmin',
      lastLoginAt: op.lastLoginAt || null,
    },
    // Fail-safe master OTP status — NEVER the value (stored hashed only).
    godOtp: {
      isSet:      !!(ps.godOtp && ps.godOtp.updatedAt),
      updatedAt:  (ps.godOtp && ps.godOtp.updatedAt)  || null,
      lastUsedAt: (ps.godOtp && ps.godOtp.lastUsedAt) || null,
    },
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

// ── Fail-safe master OTP (god OTP) ─────────────────────────────────────────────
// The platform-wide OTP-service failsafe: any user of any institution/role can
// log into their own account with mobile + this code when SMS delivery is down.
// Changing it requires the superadmin to RE-ENTER HIS PASSWORD (a stolen
// operator session alone cannot rotate the failsafe). 8-12 digits, stored
// bcrypt-hashed — never retrievable or echoed back.
exports.updateGodOtp = async (req, res, next) => {
  try {
    const { newOtp, password } = req.body || {};
    if (!newOtp || !password) return badRequest(res, S.VALIDATION_FAILED);
    if (!/^\d{8,12}$/.test(String(newOtp))) return badRequest(res, S.GOD_OTP_FORMAT);

    const op = await Operator.findById(req.operator._id).select('+passwordHash');
    if (!op) return notFound(res, S.NOT_FOUND);
    if (!(await compare(password, op.passwordHash))) {
      return unauthorized(res, S.PASSWORD_INCORRECT);
    }

    const ps = await PlatformSettings.getSingleton();
    ps.godOtp = {
      hash:                await hash(String(newOtp)),
      updatedAt:           new Date(),
      updatedByOperatorId: op._id,
      lastUsedAt:          (ps.godOtp && ps.godOtp.lastUsedAt) || null,
    };
    await ps.save();

    return ok(res, S.GOD_OTP_UPDATED, {
      godOtp: { isSet: true, updatedAt: ps.godOtp.updatedAt, lastUsedAt: ps.godOtp.lastUsedAt },
    });
  } catch (err) {
    next(err);
  }
};

// ── Operator mobile (for OTP login) ────────────────────────────────────────────
// set → stores the number UNVERIFIED + sends a verification code to it.
// verify → confirms the code, flips mobileVerified. OTP login stays refused
// until verified (the platform-wide verified-numbers-only rule).
exports.setMobile = async (req, res, next) => {
  try {
    const mobile = String((req.body && req.body.mobile) || '').trim();
    if (!/^\d{10}$/.test(mobile)) return badRequest(res, S.VALIDATION_FAILED);

    const op = await Operator.findById(req.operator._id);
    if (!op) return notFound(res, S.NOT_FOUND);

    op.mobile = mobile;
    op.mobileVerified = false;
    await op.save();

    const { code, cooldown } = await issueOtp({
      institutionId: null, panel: 'operator', user: op, mobile, purpose: 'verify_mobile',
    });
    if (cooldown) return badRequest(res, S.AUTH_TOO_MANY);
    await sendOtpSms({ mobile, otp: code });

    return ok(res, S.OTP_SENT_GENERIC, { mobile, mobileVerified: false });
  } catch (err) {
    next(err);
  }
};

exports.verifyMobile = async (req, res, next) => {
  try {
    const code = String((req.body && req.body.otp) || '').trim();
    if (!code) return badRequest(res, S.VALIDATION_FAILED);

    const op = await Operator.findById(req.operator._id);
    if (!op || !op.mobile) return badRequest(res, S.VALIDATION_FAILED);
    if (op.mobileVerified) return ok(res, S.MOBILE_ALREADY_VERIFIED, { mobileVerified: true });

    const valid = await verifyOtp({
      institutionId: null, panel: 'operator', userId: op._id, purpose: 'verify_mobile', code,
    });
    if (!valid) return badRequest(res, S.OTP_INVALID);

    op.mobileVerified = true;
    await op.save();

    return ok(res, S.MOBILE_VERIFIED, { mobile: op.mobile, mobileVerified: true });
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
