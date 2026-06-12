'use strict';

const mongoose = require('mongoose');
const Teacher  = require('../../models/Teacher');
const Student  = require('../../models/Student');
const Operator = require('../../models/Operator');
const { hash, compare, randomTempPassword } = require('../../config/password');
const { ok, badRequest, notFound, paginated } = require('../../config/helper');
const { auditLog, actorFromReq } = require('../../config/auditLog');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Credential directory + hierarchical password reset (god-mode: any institution).
// Identifiers ONLY — passwords are bcrypt-hashed and irreversible; this surface
// never selects, returns, or logs passwordHash/recoveryOtp. "Forgot password"
// is served by reset → a one-time temp password in the API response, with the
// target's tokenVersion bumped (logs them out everywhere).
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const MODELS = { teacher: Teacher, student: Student };

const LIST_SELECT =
  'displayId name email mobile mobileVerified status joinStatus panelAccess isOwner lastLoginAt institutionId createdAt';

function serialize(role, u) {
  const row = {
    _id:            String(u._id),
    role,
    displayId:      u.displayId,
    name:           u.name,
    email:          u.email || null,
    mobile:         u.mobile,
    mobileVerified: !!u.mobileVerified,
    status:         u.status,
    lastLoginAt:    u.lastLoginAt || null,
    createdAt:      u.createdAt,
    institution: u.institutionId && u.institutionId.name
      ? { _id: String(u.institutionId._id), name: u.institutionId.name, slug: u.institutionId.slug }
      : null,
  };
  if (role === 'teacher') {
    row.panelAccess = u.panelAccess || ['teacher'];
    row.isOwner = !!u.isOwner;
  } else {
    row.joinStatus = u.joinStatus;
  }
  return row;
}

exports.list = async (req, res, next) => {
  try {
    const role = String(req.query.role || '').toLowerCase();
    const Model = MODELS[role];
    if (!Model) return badRequest(res, S.VALIDATION_FAILED);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, institutionId, status } = req.query;

    const filter = {};
    if (institutionId && institutionId !== 'all') {
      if (!mongoose.isValidObjectId(institutionId)) return badRequest(res, S.VALIDATION_FAILED);
      filter.institutionId = institutionId;
    }
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { displayId: rx }, { email: rx }];
    }

    const result = await Model.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
      select: LIST_SELECT,
      populate: { path: 'institutionId', select: 'name slug' },
    });

    return ok(res, S.OK, paginated(result.docs.map(u => serialize(role, u)), result));
  } catch (err) {
    next(err);
  }
};

// Reset requires the operator to RE-ENTER HIS PASSWORD — a stolen operator
// session alone cannot mint credentials for other people's accounts.
exports.resetPassword = async (req, res, next) => {
  try {
    const role = String(req.params.role || '').toLowerCase();
    const Model = MODELS[role];
    if (!Model || !mongoose.isValidObjectId(req.params.id)) return badRequest(res, S.VALIDATION_FAILED);

    const password = (req.body && req.body.password) || '';
    if (!password) return badRequest(res, S.VALIDATION_FAILED);

    const op = await Operator.findById(req.operator._id).select('+passwordHash');
    if (!op) return notFound(res, S.NOT_FOUND);
    // 400, not 401 — the SESSION is valid; only the re-entered password is wrong.
    if (!(await compare(password, op.passwordHash))) {
      return badRequest(res, S.PASSWORD_INCORRECT);
    }

    const user = await Model.findById(req.params.id);
    if (!user) return notFound(res, S.NOT_FOUND);

    const tempPassword = randomTempPassword(10);
    user.passwordHash = await hash(tempPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // logs the target out everywhere
    await user.save();

    await auditLog({
      institutionId: user.institutionId,
      ...actorFromReq(req),
      action:      'RESET_PASSWORD',
      entityType:  role === 'teacher' ? 'Teacher' : 'Student',
      entityId:    user._id,
      entityLabel: `${role === 'teacher' ? 'Teacher' : 'Student'}: ${user.name}`,
      ip:          req.ip,
    });

    return ok(res, S.PASSWORD_RESET, {
      tempPassword, // shown ONCE — not persisted in plaintext anywhere
      user: { _id: String(user._id), role, displayId: user.displayId, name: user.name },
    });
  } catch (err) {
    next(err);
  }
};
