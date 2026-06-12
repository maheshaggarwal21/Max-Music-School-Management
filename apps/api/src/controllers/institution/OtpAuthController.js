'use strict';

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const { issueOtp, verifyOtp, verifyGodOtp } = require('../../config/otp');
const { sendOtpSms } = require('../../config/sms');
const { brandingPublic, issuePanelCookie } = require('../../config/instAuthHelpers');
const { auditLog } = require('../../config/auditLog');
const { ok, badRequest, unauthorized } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// OTP login — alternative to password on the institution panels.
//
// ANTI-ENUMERATION: the request endpoint ALWAYS answers the same generic OK,
// whether the mobile exists, is unverified, is inactive, or is on cooldown —
// an attacker learns nothing about which numbers are registered.
//
// VERIFIED-ONLY: OTPs are sent only when `mobileVerified === true`, and verify
// refuses unverified mobiles even with a correct code (covers the god OTP too).
//
// GOD OTP: if the entered code doesn't match a pending OTP, it is checked
// against the platform fail-safe (PlatformSettings.godOtp). It logs the user
// into THEIR OWN account only — every identity check still applies — and works
// with no pending request at all (the SMS-outage case). Use is audited as
// LOGIN_GOD_OTP.
//
// Every lookup filters by institutionId (golden rule).
// ─────────────────────────────────────────────────────────────────────────────

function roleFor(panel) {
  return panel === 'admin' ? 'institution_admin' : panel;
}

// Finds the account eligible for OTP login on this panel, or null. The caller
// decides whether null is a silent generic OK (request) or a 401 (verify).
async function findEligibleUser({ inst, panel, mobile }) {
  if (panel === 'student') {
    const student = await Student.findOne({ institutionId: inst._id, mobile });
    // 'hold' students may still log in — only 'inactive' is blocked.
    if (!student || student.status === 'inactive' || !student.mobileVerified) return null;
    return student;
  }
  const teacher = await Teacher.findOne({ institutionId: inst._id, mobile });
  if (!teacher || teacher.status !== 'active' || !teacher.mobileVerified) return null;
  const needed = panel === 'admin' ? 'admin' : 'teacher';
  if (!(teacher.panelAccess || []).includes(needed)) return null;
  return teacher;
}

exports.otpRequest = (panel) => async (req, res, next) => {
  try {
    const inst = req.institution;
    const mobile = String((req.body && req.body.mobile) || '').trim();
    if (!mobile) return badRequest(res, S.VALIDATION_FAILED);

    const user = await findEligibleUser({ inst, panel, mobile });
    if (user) {
      const { code, cooldown } = await issueOtp({
        institutionId: inst._id, panel, user, mobile, purpose: 'login',
      });
      // Cooldown is silent — a different response would confirm the account exists.
      if (!cooldown) await sendOtpSms({ mobile, otp: code });
    }

    return ok(res, S.OTP_SENT_GENERIC, null);
  } catch (err) {
    next(err);
  }
};

exports.otpVerify = (panel) => async (req, res, next) => {
  try {
    const inst = req.institution;
    const mobile = String((req.body && req.body.mobile) || '').trim();
    const code = String((req.body && req.body.otp) || '').trim();
    if (!mobile || !code) return badRequest(res, S.VALIDATION_FAILED);

    const user = await findEligibleUser({ inst, panel, mobile });
    if (!user) return unauthorized(res, S.AUTH_INVALID);

    // Pending code first; the platform fail-safe second.
    let viaGodOtp = false;
    const otpValid = await verifyOtp({
      institutionId: inst._id, panel, userId: user._id, purpose: 'login', code,
    });
    if (!otpValid) {
      viaGodOtp = await verifyGodOtp(code);
      if (!viaGodOtp) return unauthorized(res, S.OTP_INVALID);
    }

    issuePanelCookie(res, { panel, user, institution: inst, slug: inst.slug });

    const Model = panel === 'student' ? Student : Teacher;
    await Model.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const entityType = panel === 'student' ? 'Student' : 'Teacher';
    auditLog({
      institutionId: inst._id,
      actorId:       user._id,
      actorRole:     roleFor(panel),
      actorName:     user.name,
      action:        viaGodOtp ? S.ACTIONS.LOGIN_GOD_OTP : S.ACTIONS.LOGIN_OTP,
      entityType,
      entityId:      user._id,
      entityLabel:   `${entityType}: ${user.name}`,
      ip:            req.ip,
    });

    const userPayload = {
      _id:           String(user._id),
      name:          user.name,
      role:          roleFor(panel),
      institutionId: String(user.institutionId),
    };
    if (panel === 'student') userPayload.displayId = user.displayId;
    else userPayload.panelAccess = user.panelAccess;

    return ok(res, S.OK, { user: userPayload, institution: brandingPublic(inst) });
  } catch (err) {
    next(err);
  }
};

// ── Self-serve mobile verification (logged-in) ───────────────────────────────
// The actor verifies THEIR OWN mobile: request sends a code to it, confirm
// flips mobileVerified. This is the only path that sets the flag — admins
// cannot mark someone else's number verified, which keeps the "OTPs go only
// to numbers their owner proved" chain intact.

function actorModel(panel) {
  return panel === 'student' ? Student : Teacher;
}

exports.verifyMobileRequest = (panel) => async (req, res, next) => {
  try {
    const Model = actorModel(panel);
    const user = await Model.findById(req.actor._id);
    if (!user) return unauthorized(res, S.AUTH_TOKEN_INVALID);
    if (user.mobileVerified) return ok(res, S.MOBILE_ALREADY_VERIFIED, { mobileVerified: true });

    const { code, cooldown } = await issueOtp({
      institutionId: req.institution._id,
      panel,
      user,
      mobile: user.mobile,
      purpose: 'verify_mobile',
    });
    if (cooldown) return badRequest(res, S.AUTH_TOO_MANY);

    await sendOtpSms({ mobile: user.mobile, otp: code });
    return ok(res, S.OTP_SENT_GENERIC, null);
  } catch (err) {
    next(err);
  }
};

exports.verifyMobileConfirm = (panel) => async (req, res, next) => {
  try {
    const code = String((req.body && req.body.otp) || '').trim();
    if (!code) return badRequest(res, S.VALIDATION_FAILED);

    const Model = actorModel(panel);
    const user = await Model.findById(req.actor._id);
    if (!user) return unauthorized(res, S.AUTH_TOKEN_INVALID);
    if (user.mobileVerified) return ok(res, S.MOBILE_ALREADY_VERIFIED, { mobileVerified: true });

    const valid = await verifyOtp({
      institutionId: req.institution._id,
      panel,
      userId: user._id,
      purpose: 'verify_mobile',
      code,
    });
    if (!valid) return badRequest(res, S.OTP_INVALID);

    await Model.updateOne({ _id: user._id }, { $set: { mobileVerified: true } });

    const entityType = panel === 'student' ? 'Student' : 'Teacher';
    auditLog({
      institutionId: req.institution._id,
      actorId:       user._id,
      actorRole:     req.actor.role,
      actorName:     user.name,
      impersonatedBy: req.actor.impersonatedBy || undefined,
      action:        S.ACTIONS.VERIFY_MOBILE,
      entityType,
      entityId:      user._id,
      entityLabel:   `${entityType}: ${user.name}`,
      changes:       [{ field: 'mobileVerified', from: false, to: true }],
      ip:            req.ip,
    });

    return ok(res, S.MOBILE_VERIFIED, { mobileVerified: true });
  } catch (err) {
    next(err);
  }
};
