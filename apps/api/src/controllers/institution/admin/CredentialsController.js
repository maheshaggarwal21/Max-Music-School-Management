'use strict';

const mongoose = require('mongoose');
const Teacher  = require('../../../models/Teacher');
const Student  = require('../../../models/Student');
const Operator = require('../../../models/Operator');
const { hash, compare, randomTempPassword } = require('../../../config/password');
const { ok, badRequest, notFound, paginated } = require('../../../config/helper');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Institution-scoped credential directory + password reset. Admin sees ONLY
// teachers/students of his own institution (golden rule — institutionId on
// every query). Identifiers only; passwordHash/recoveryOtp never selected,
// returned, or logged. Reset = one-time temp password + tokenVersion bump.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const MODELS = { teacher: Teacher, student: Student };

const LIST_SELECT =
  'displayId name email mobile mobileVerified status joinStatus panelAccess isOwner lastLoginAt createdAt';

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
  };
  if (role === 'teacher') {
    row.panelAccess = u.panelAccess || ['teacher'];
    row.isOwner = !!u.isOwner;
  } else {
    row.joinStatus = u.joinStatus;
  }
  return row;
}

// The re-entered password belongs to whoever is ACTING: the owner-teacher
// normally, the operator when impersonating via god-token.
async function verifyActorPassword(req, password) {
  if (req.actor && req.actor.godMode) {
    const op = await Operator.findById(req.actor.impersonatedBy).select('+passwordHash');
    return !!(op && (await compare(password, op.passwordHash)));
  }
  const t = await Teacher.findOne({ _id: req.actor._id, institutionId: req.institution._id })
    .select('+passwordHash');
  return !!(t && (await compare(password, t.passwordHash)));
}

exports.list = async (req, res, next) => {
  try {
    const role = String(req.query.role || '').toLowerCase();
    const Model = MODELS[role];
    if (!Model) return badRequest(res, S.VALIDATION_FAILED);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, status } = req.query;

    const filter = { institutionId: req.institution._id };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { displayId: rx }, { email: rx }];
    }

    const result = await Model.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, select: LIST_SELECT,
    });

    return ok(res, S.OK, paginated(result.docs.map(u => serialize(role, u)), result));
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const role = String(req.params.role || '').toLowerCase();
    const Model = MODELS[role];
    if (!Model || !mongoose.isValidObjectId(req.params.id)) return badRequest(res, S.VALIDATION_FAILED);

    const password = (req.body && req.body.password) || '';
    if (!password) return badRequest(res, S.VALIDATION_FAILED);

    // 400, not 401 — the SESSION is valid; only the re-entered password is wrong.
    if (!(await verifyActorPassword(req, password))) {
      return badRequest(res, S.PASSWORD_INCORRECT);
    }

    const user = await Model.findOne({ _id: req.params.id, institutionId: req.institution._id });
    if (!user) return notFound(res, S.NOT_FOUND);

    const tempPassword = randomTempPassword(10);
    user.passwordHash = await hash(tempPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1; // logs the target out everywhere
    await user.save();

    await auditLog({
      institutionId: req.institution._id,
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
