'use strict';

const Student    = require('../../../models/Student');
const Batch      = require('../../../models/Batch');
const Attendance = require('../../../models/Attendance');
const AuditLog   = require('../../../models/AuditLog');
const { nextDisplayId } = require('../../../config/specialFunctions');
const { studentRefsValid } = require('../../../config/refGuard');
const { hash, randomTempPassword } = require('../../../config/password');
const { auditLog, actorFromReq, diff } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin student management. GOLDEN RULE: every query scoped to req.institution._id.
// Editable fields are whitelisted; every diff is audited (one immutable feed
// powers the per-student activity tab — same AuditLog, filtered by entityId).
// passwordHash / recoveryOtp are select:false → never serialized.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const EDITABLE = [
  'teacherId', 'batchId', 'instrumentId', 'gender', 'classType', 'mode', 'joinStatus',
  'sessionType', 'category', 'validityStart', 'validityEnd', 'validityDays',
  'paidClasses', 'upcomingClasses', 'paidAmount', 'upcomingAmount', 'status',
];

const ROW_POPULATE = [
  { path: 'batchId', select: 'name dayPatternId timeSlotId', populate: [
    { path: 'dayPatternId', select: 'label' },
    { path: 'timeSlotId',   select: 'label' },
  ] },
  { path: 'teacherId',    select: 'name' },
  { path: 'instrumentId', select: 'name' },
];

function rowOf(s) {
  return {
    _id:       String(s._id),
    displayId: s.displayId,
    name:      s.name,
    mobile:    s.mobile,
    instrument: s.instrumentId ? s.instrumentId.name : null,
    classType: s.classType || null,
    schedule: {
      days: (s.batchId && s.batchId.dayPatternId) ? s.batchId.dayPatternId.label : null,
      time: (s.batchId && s.batchId.timeSlotId)   ? s.batchId.timeSlotId.label   : null,
    },
    joinStatus:  s.joinStatus,
    validityEnd: s.validityEnd || null,
    teacher: s.teacherId ? { _id: String(s.teacherId._id), name: s.teacherId.name } : null,
  };
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, status, joinStatus, teacherId, batchId } = req.query;

    const filter = { institutionId: inst };
    if (status)     filter.status = status;
    if (joinStatus) filter.joinStatus = joinStatus;
    if (teacherId)  filter.teacherId = teacherId;
    if (batchId)    filter.batchId = batchId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { displayId: rx }];
    }

    const result = await Student.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: ROW_POPULATE,
    });
    return ok(res, S.OK, paginated(result.docs.map(rowOf), result));
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const s = await Student.findOne({ _id: req.params.id, institutionId: inst })
      .populate(ROW_POPULATE).lean();
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);

    const att = await Attendance.aggregate([
      { $match: { institutionId: s.institutionId, studentId: s._id } },
      { $group: { _id: '$status', c: { $sum: 1 } } },
    ]);
    const am = new Map(att.map(x => [x._id, x.c]));
    const present = am.get('present') || 0;
    const absent  = am.get('absent') || 0;
    const total   = att.reduce((n, x) => n + x.c, 0);

    const detail = {
      ...rowOf(s),
      email:  s.email || null,
      gender: s.gender || null,
      mode:   s.mode,
      sessionType: s.sessionType,
      category:    s.category,
      validityStart: s.validityStart || null,
      validityDays:  s.validityDays || null,
      paidClasses:     s.paidClasses || 0,
      upcomingClasses: s.upcomingClasses || 0,
      paidAmount:      s.paidAmount || 0,
      upcomingAmount:  s.upcomingAmount || 0,
      attendanceSummary: { total, present, absent },
      batch: s.batchId ? { _id: String(s.batchId._id), name: s.batchId.name } : null,
      assignedVideoChapterId: s.assignedVideoChapterId ? String(s.assignedVideoChapterId) : null,
    };
    // Contract (CONTRACTS.md): GET /students/:id → StudentDetail (bare object).
    return ok(res, S.OK, detail);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { name, mobile } = req.body || {};
    if (!name || !mobile) return badRequest(res, S.VALIDATION_FAILED);

    // GOLDEN RULE: foreign teacher/batch/instrument refs must be rejected before persist.
    if (!(await studentRefsValid(inst, req.body))) return badRequest(res, S.STUDENT_BAD_REFS);

    const displayId = await nextDisplayId(inst, 'student');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const doc = { institutionId: inst, displayId, name: String(name).trim(), mobile: String(mobile).trim(), passwordHash };
    if (req.body.email) doc.email = String(req.body.email).toLowerCase().trim();
    for (const f of EDITABLE) if (req.body[f] !== undefined) doc[f] = req.body[f];

    const student = await Student.create(doc);
    if (student.batchId) {
      await Batch.updateOne({ _id: student.batchId, institutionId: inst }, { $inc: { studentCount: 1 } });
    }

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'CREATE_STUDENT',
      entityType: 'Student',
      entityId: student._id,
      entityLabel: `Student: ${student.name}`,
      after: { displayId: student.displayId, paidAmount: student.paidAmount },
      ip: req.ip,
    });

    return created(res, S.STUDENT_CREATED, {
      student: { _id: String(student._id), displayId: student.displayId, name: student.name },
      tempPassword,
    });
  } catch (err) {
    next(err);
  }
};

exports.patch = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const student = await Student.findOne({ _id: req.params.id, institutionId: inst });
    if (!student) return notFound(res, S.STUDENT_NOT_FOUND);

    // GOLDEN RULE: reject foreign teacher/batch/instrument refs before persist.
    if (!(await studentRefsValid(inst, req.body))) return badRequest(res, S.STUDENT_BAD_REFS);

    const before = student.toObject();
    const prevBatch = before.batchId ? String(before.batchId) : null;

    for (const f of EDITABLE) {
      if (req.body[f] !== undefined) student[f] = req.body[f];
    }
    await student.save();

    // Keep batch studentCount consistent on reassignment.
    const newBatch = student.batchId ? String(student.batchId) : null;
    if (prevBatch !== newBatch) {
      if (prevBatch) await Batch.updateOne({ _id: prevBatch, institutionId: inst }, { $inc: { studentCount: -1 } });
      if (newBatch)  await Batch.updateOne({ _id: newBatch, institutionId: inst }, { $inc: { studentCount: 1 } });
    }

    const changes = diff(before, student.toObject(), EDITABLE);
    const action = changes.some(c => c.field === 'paidAmount') ? 'UPDATE_PAID_AMOUNT' : 'UPDATE_STUDENT';
    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action,
      entityType: 'Student',
      entityId: student._id,
      entityLabel: `Student: ${student.name}`,
      changes,
      ip: req.ip,
    });

    return ok(res, S.STUDENT_UPDATED, { student: { _id: String(student._id) } });
  } catch (err) {
    next(err);
  }
};

exports.activityFeed = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    // Confirm the student belongs to this institution before exposing its feed.
    const exists = await Student.exists({ _id: req.params.id, institutionId: inst });
    if (!exists) return notFound(res, S.STUDENT_NOT_FOUND);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const result = await AuditLog.paginate(
      { institutionId: inst, entityType: 'Student', entityId: String(req.params.id) },
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
