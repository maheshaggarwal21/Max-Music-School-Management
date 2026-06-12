'use strict';

const Teacher  = require('../../../models/Teacher');
const Batch    = require('../../../models/Batch');
const AuditLog = require('../../../models/AuditLog');
const { nextDisplayId } = require('../../../config/specialFunctions');
const { hash, randomTempPassword } = require('../../../config/password');
const { auditLog, actorFromReq, diff } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const { sendMail } = require('../../../config/mailer');
const { teacherWelcome } = require('../../../config/emailTemplates');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin teacher (staff) management. GOLDEN RULE: scoped to req.institution._id.
// HARD RULE: admin can NEVER set panelAccess or isOwner — granting admin access
// is an OPERATOR-only action. Any request including either field is rejected.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const EDITABLE = ['name', 'mobile', 'altMobile', 'email', 'gender', 'dob',
  'profilePicUrl', 'razorpayPaymentLink', 'salaryAmount', 'performance', 'kpiPercent', 'status'];

const FORBIDDEN = ['panelAccess', 'isOwner', 'employmentType', 'tokenVersion', 'institutionId'];

async function activeBatchMap(inst, teacherIds) {
  if (!teacherIds.length) return new Map();
  const agg = await Batch.aggregate([
    { $match: { institutionId: inst, teacherId: { $in: teacherIds }, status: 'active' } },
    { $group: { _id: '$teacherId', c: { $sum: 1 } } },
  ]);
  return new Map(agg.map(x => [String(x._id), x.c]));
}

function rowOf(t, batchCount) {
  return {
    _id:       String(t._id),
    displayId: t.displayId,
    name:      t.name,
    mobile:    t.mobile,
    email:     t.email,
    role:        t.isOwner ? 'owner' : 'staff',
    panelAccess: t.panelAccess,
    activeBatches: batchCount,
    performance: typeof t.performance === 'number' ? t.performance : null,
    kpiPercent:  typeof t.kpiPercent === 'number' ? t.kpiPercent : null,
    status:      t.status,
  };
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, status } = req.query;

    const filter = { institutionId: inst };
    if (status) filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { email: rx }, { displayId: rx }];
    }

    const result = await Teacher.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
    });
    const bMap = await activeBatchMap(inst, result.docs.map(d => d._id));
    const items = result.docs.map(t => rowOf(t, bMap.get(String(t._id)) || 0));
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    if (FORBIDDEN.some(f => req.body && req.body[f] !== undefined)) {
      return badRequest(res, S.TEACHER_PANEL_ACCESS_FORBIDDEN);
    }
    const { name, mobile, email } = req.body || {};
    if (!name || !mobile || !email) return badRequest(res, S.VALIDATION_FAILED);

    const displayId = await nextDisplayId(inst, 'teacher');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const doc = {
      institutionId: inst, displayId,
      name: String(name).trim(), mobile: String(mobile).trim(), email: String(email).toLowerCase().trim(),
      panelAccess: ['teacher'], isOwner: false, employmentType: 'salary',
      passwordHash,
    };
    for (const f of ['altMobile', 'gender', 'dob', 'razorpayPaymentLink', 'salaryAmount']) {
      if (req.body[f] !== undefined) doc[f] = req.body[f];
    }

    const teacher = await Teacher.create(doc);

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'CREATE_TEACHER',
      entityType: 'Teacher',
      entityId: teacher._id,
      entityLabel: `Teacher: ${teacher.name}`,
      after: { displayId: teacher.displayId, employmentType: teacher.employmentType },
      ip: req.ip,
    });

    // Email the teacher their temporary password (fail-soft).
    if (teacher.email) {
      const slug = req.institution.slug;
      const panelUrl = `${process.env.PLATFORM_DOMAIN_URL || ''}/${slug}/teacher`;
      const tpl = teacherWelcome({
        schoolName:   req.institution.branding.schoolName,
        primaryColor: req.institution.branding.primaryColor,
        teacherName:  teacher.name,
        panelUrl,
        tempPassword,
      });
      sendMail({ to: teacher.email, ...tpl, institution: req.institution }).catch(() => {});
    }

    return created(res, S.TEACHER_CREATED, {
      teacher: { _id: String(teacher._id), displayId: teacher.displayId, name: teacher.name },
      tempPassword,
    });
  } catch (err) {
    next(err);
  }
};

exports.patch = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    if (FORBIDDEN.some(f => req.body && req.body[f] !== undefined)) {
      return badRequest(res, S.TEACHER_PANEL_ACCESS_FORBIDDEN);
    }
    const teacher = await Teacher.findOne({ _id: req.params.id, institutionId: inst });
    if (!teacher) return notFound(res, S.TEACHER_NOT_FOUND);

    const before = teacher.toObject();
    for (const f of EDITABLE) {
      if (req.body[f] !== undefined) teacher[f] = req.body[f];
    }
    if (typeof teacher.email === 'string') teacher.email = teacher.email.toLowerCase().trim();
    // A changed mobile is an unproven number — OTP login must re-verify it.
    if (String(before.mobile) !== String(teacher.mobile)) teacher.mobileVerified = false;
    await teacher.save();

    const changes = diff(before, teacher.toObject(), EDITABLE);
    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'UPDATE_TEACHER',
      entityType: 'Teacher',
      entityId: teacher._id,
      entityLabel: `Teacher: ${teacher.name}`,
      changes,
      ip: req.ip,
    });

    return ok(res, S.TEACHER_UPDATED, { teacher: { _id: String(teacher._id) } });
  } catch (err) {
    next(err);
  }
};

exports.activityFeed = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    // Confirm the teacher belongs to this institution before exposing its feed.
    const exists = await Teacher.exists({ _id: req.params.id, institutionId: inst });
    if (!exists) return notFound(res, S.TEACHER_NOT_FOUND);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const result = await AuditLog.paginate(
      { institutionId: inst, entityType: 'Teacher', entityId: String(req.params.id) },
      { page, limit, sort: { createdAt: -1 }, lean: true }
    );

    const items = result.docs.map(a => ({
      _id: String(a._id),
      actorRole: a.actorRole,
      actorName: a.actorName,
      impersonatedBy: a.impersonatedBy ? String(a.impersonatedBy) : null,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      entityLabel: a.entityLabel || null,
      changes: a.changes || [],
      createdAt: a.createdAt,
    }));
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};
