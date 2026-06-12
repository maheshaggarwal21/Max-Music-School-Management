'use strict';

const mongoose    = require('mongoose');
const Student     = require('../../models/Student');
const Institution = require('../../models/Institution');
const Batch       = require('../../models/Batch');
const Attendance  = require('../../models/Attendance');
const Teacher     = require('../../models/Teacher');
const Instrument  = require('../../models/Instrument');
const DayPattern  = require('../../models/DayPattern');
const ClassLevel  = require('../../models/ClassLevel');
const { nextDisplayId } = require('../../config/specialFunctions');
const { studentRefsValid } = require('../../config/refGuard');
const { hash, randomTempPassword } = require('../../config/password');
const { ok, created, badRequest, notFound, paginated } = require('../../config/helper');
const { auditLog, diff, actorFromReq } = require('../../config/auditLog');
const { derivePaymentStatus, remainingAmount } = require('../../config/payments');
const S = require('../../config/strings');

const JOIN_STATUSES = ['trial', 'active_soon', 'active', 'inactive'];

// Fields the operator may set on a new student (same set the admin create accepts).
const CREATE_FIELDS = [
  'teacherId', 'batchId', 'instrumentId', 'classLevelId', 'gender', 'classType', 'mode', 'joinStatus',
  'sessionType', 'category', 'validityStart', 'validityEnd', 'validityDays',
  'paidClasses', 'upcomingClasses', 'paidAmount', 'upcomingAmount', 'feeTotal', 'remarks', 'status',
];

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-INSTITUTION student view (god-mode). The ONLY place students from many
// institutions appear together. Every row is TAGGED with its institution + teacher.
// institutionId here is an optional FILTER from the operator, never an isolation
// boundary — this route is intentionally outside /api/inst/:slug/*.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const POPULATE = [
  { path: 'institutionId', select: 'name slug' },
  { path: 'teacherId',     select: 'name' },
  { path: 'batchId',       select: 'name' },
  { path: 'instrumentId',  select: 'name' },
  { path: 'classLevelId',  select: 'name' },
];

function serialize(s) {
  return {
    _id:       String(s._id),
    displayId: s.displayId,
    name:      s.name,
    mobile:    s.mobile,
    email:     s.email || null,
    institution: s.institutionId
      ? { _id: String(s.institutionId._id), name: s.institutionId.name, slug: s.institutionId.slug }
      : null,
    teacher: s.teacherId ? { _id: String(s.teacherId._id), name: s.teacherId.name } : null,
    batch:   s.batchId ? { _id: String(s.batchId._id), name: s.batchId.name } : null,
    instrument: s.instrumentId ? s.instrumentId.name : null,
    classLevel: s.classLevelId ? { _id: String(s.classLevelId._id), name: s.classLevelId.name } : null,
    joinStatus:     s.joinStatus,
    paymentStatus:  s.paymentStatus || 'unpaid',
    paidAmount:     s.paidAmount || 0,
    upcomingAmount: s.upcomingAmount || 0,
    feeTotal:       s.feeTotal || 0,
    remainingAmount: remainingAmount(s.feeTotal, s.paidAmount),
    remarks:        s.remarks || null,
    validityEnd:    s.validityEnd || null,
    createdAt:      s.createdAt,
  };
}

// Detail populate (adds the batch's day-pattern + time-slot for the schedule).
const DETAIL_POPULATE = [
  { path: 'institutionId', select: 'name slug' },
  { path: 'teacherId',     select: 'name' },
  { path: 'batchId',       select: 'name dayPatternId timeSlotId', populate: [
    { path: 'dayPatternId', select: 'label' },
    { path: 'timeSlotId',   select: 'label' },
  ] },
  { path: 'instrumentId',  select: 'name' },
  { path: 'classLevelId',  select: 'name' },
];

// Full detail (parity with the institution admin StudentDetail) — powers the
// operator's student view + edit form.
function detailOf(s, att) {
  return {
    ...serialize(s),
    gender:          s.gender || null,
    classType:       s.classType || null,
    mode:            s.mode,
    sessionType:     s.sessionType,
    category:        s.category,
    validityStart:   s.validityStart || null,
    validityDays:    s.validityDays || null,
    paidClasses:     s.paidClasses || 0,
    upcomingClasses: s.upcomingClasses || 0,
    attendanceSummary: att || { total: 0, present: 0, absent: 0 },
    schedule: {
      days: (s.batchId && s.batchId.dayPatternId) ? s.batchId.dayPatternId.label : null,
      time: (s.batchId && s.batchId.timeSlotId)   ? s.batchId.timeSlotId.label   : null,
    },
    assignedVideoChapterId: s.assignedVideoChapterId ? String(s.assignedVideoChapterId) : null,
  };
}

exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, institutionId, status, joinStatus, instrumentId, teacherId } = req.query;

    const filter = {};
    if (institutionId && institutionId !== 'all') filter.institutionId = institutionId;
    if (status && status !== 'all')               filter.status = status;
    if (joinStatus && joinStatus !== 'all')       filter.joinStatus = joinStatus;
    if (instrumentId && instrumentId !== 'all')   filter.instrumentId = instrumentId;
    if (teacherId && teacherId !== 'all')         filter.teacherId = teacherId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { displayId: rx }];
    }

    const result = await Student.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: POPULATE,
    });

    return ok(res, S.OK, paginated(result.docs.map(serialize), result));
  } catch (err) {
    next(err);
  }
};

// ── GOD-MODE CREATE ──────────────────────────────────────────────────────────
// Operator directly enrols a student into ANY institution (institutionId comes
// from the body — this is the ONE create that is cross-institution by design).
// Mirrors the admin create, but the target tenant is explicit + validated. All
// teacher/batch/instrument refs are checked against THAT institution (golden rule).
exports.create = async (req, res, next) => {
  try {
    const { institutionId, name, mobile } = req.body || {};
    if (!institutionId || !mongoose.isValidObjectId(institutionId)) return badRequest(res, S.VALIDATION_FAILED);
    if (!name || !mobile) return badRequest(res, S.VALIDATION_FAILED);

    const inst = await Institution.findById(institutionId).select('_id status').lean();
    if (!inst) return notFound(res, S.INST_NOT_FOUND);
    if (inst.status === 'terminated') return badRequest(res, S.INST_NOT_AVAILABLE);

    // GOLDEN RULE: foreign teacher/batch/instrument refs rejected before persist.
    if (!(await studentRefsValid(inst._id, req.body))) return badRequest(res, S.STUDENT_BAD_REFS);

    if (req.body.joinStatus !== undefined && !JOIN_STATUSES.includes(req.body.joinStatus)) {
      return badRequest(res, S.VALIDATION_FAILED);
    }

    const displayId    = await nextDisplayId(inst._id, 'student');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const doc = {
      institutionId: inst._id, displayId,
      name: String(name).trim(), mobile: String(mobile).trim(), passwordHash,
    };
    if (req.body.email) doc.email = String(req.body.email).toLowerCase().trim();
    for (const f of CREATE_FIELDS) if (req.body[f] !== undefined) doc[f] = req.body[f];
    doc.paymentStatus = derivePaymentStatus(doc.feeTotal, doc.paidAmount, { forceFree: req.body.paymentStatus === 'free' });

    const student = await Student.create(doc);
    if (student.batchId) {
      await Batch.updateOne({ _id: student.batchId, institutionId: inst._id }, { $inc: { studentCount: 1 } });
    }

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'CREATE_STUDENT',
      entityType:  'Student',
      entityId:    student._id,
      entityLabel: `Student: ${student.name}`,
      after:       { displayId: student.displayId, paidAmount: student.paidAmount },
      ip:          req.ip,
    });

    // Re-fetch populated so the operator table row carries institution/teacher tags.
    const full = await Student.findById(student._id).populate(POPULATE).lean();
    return created(res, S.STUDENT_CREATED, { student: serialize(full), tempPassword });
  } catch (err) {
    next(err);
  }
};

async function attendanceSummaryOf(s) {
  const agg = await Attendance.aggregate([
    { $match: { institutionId: s.institutionId, studentId: s._id } },
    { $group: { _id: '$status', c: { $sum: 1 } } },
  ]);
  const m = new Map(agg.map(x => [x._id, x.c]));
  const present = m.get('present') || 0;
  const absent  = m.get('absent') || 0;
  return { total: agg.reduce((n, x) => n + x.c, 0), present, absent };
}

exports.get = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id).populate(DETAIL_POPULATE).lean();
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    const att = await attendanceSummaryOf(s);
    return ok(res, S.OK, detailOf(s, att));
  } catch (err) {
    next(err);
  }
};

// Per-institution catalog for the student edit form — instruments, active
// teachers, batches, day-patterns, class-levels of the student's OWN institution.
exports.catalog = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id).select('institutionId').lean();
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    const inst = s.institutionId;
    const [instruments, teachers, batches, dayPatterns, classLevels] = await Promise.all([
      Instrument.find({ institutionId: inst, isActive: true }).select('name').sort({ name: 1 }).lean(),
      Teacher.find({ institutionId: inst, status: 'active' }).select('name').sort({ name: 1 }).lean(),
      Batch.find({ institutionId: inst, status: { $in: ['setting', 'active'] } })
        .select('name dayPatternId timeSlotId status')
        .populate([{ path: 'dayPatternId', select: 'label' }, { path: 'timeSlotId', select: 'label' }])
        .sort({ createdAt: -1 }).lean(),
      DayPattern.find({ institutionId: inst, isActive: true }).select('days label isActive').lean(),
      ClassLevel.find({ institutionId: inst, isActive: true }).select('name upcomingAmount days').lean(),
    ]);
    return ok(res, S.OK, {
      instruments: instruments.map(i => ({ _id: String(i._id), name: i.name })),
      teachers:    teachers.map(t => ({ _id: String(t._id), name: t.name })),
      batches:     batches.map(b => ({
        _id: String(b._id), name: b.name, status: b.status,
        dayPattern: b.dayPatternId ? { _id: String(b.dayPatternId._id), label: b.dayPatternId.label } : null,
        timeSlot:   b.timeSlotId ? { _id: String(b.timeSlotId._id), label: b.timeSlotId.label } : null,
      })),
      dayPatterns: dayPatterns.map(d => ({ _id: String(d._id), days: d.days, label: d.label, isActive: d.isActive })),
      classLevels: classLevels.map(c => ({ _id: String(c._id), name: c.name, upcomingAmount: c.upcomingAmount || 0, days: c.days || 0 })),
    });
  } catch (err) {
    next(err);
  }
};

// ── GOD-MODE EDIT ──────────────────────────────────────────────────────────────
// Operator can patch a student from any institution — full parity with the
// institution admin edit (incl. structural teacher/batch/instrument/class-level).
// Foreign refs are rejected via refGuard scoped to the student's OWN institutionId
// (cross-institution refs would leak another tenant's data through populate). Each
// change is audited per-diff into that institution's activity feed.
const FEE_FIELDS = ['paidAmount', 'upcomingAmount', 'paidClasses', 'validityEnd', 'feeTotal', 'paymentStatus'];
const EDITABLE = [
  'teacherId', 'batchId', 'instrumentId', 'classLevelId', 'gender', 'classType', 'mode', 'joinStatus',
  'sessionType', 'category', 'validityStart', 'validityEnd', 'validityDays',
  'paidClasses', 'upcomingClasses', 'paidAmount', 'upcomingAmount', 'feeTotal', 'remarks', 'status',
];

exports.update = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);

    const b = req.body || {};

    // GOLDEN RULE: structural refs must belong to the student's OWN institution.
    if (!(await studentRefsValid(s.institutionId, b))) return badRequest(res, S.STUDENT_BAD_REFS);

    const before = s.toObject();
    const prevBatch = before.batchId ? String(before.batchId) : null;

    // Profile
    if (typeof b.name === 'string' && b.name.trim()) s.name = b.name.trim();
    if (typeof b.mobile === 'string' && b.mobile.trim()) {
      if (!/^\d{10}$/.test(b.mobile.trim())) return badRequest(res, S.VALIDATION_FAILED);
      if (s.mobile !== b.mobile.trim()) s.mobileVerified = false; // changed number → OTP must re-verify
      s.mobile = b.mobile.trim();
    }
    if (b.joinStatus !== undefined && !JOIN_STATUSES.includes(b.joinStatus)) return badRequest(res, S.VALIDATION_FAILED);
    for (const d of ['validityStart', 'validityEnd']) {
      if (b[d] !== undefined && b[d] != null && b[d] !== '' && Number.isNaN(Date.parse(b[d]))) {
        return badRequest(res, S.VALIDATION_FAILED);
      }
    }
    for (const n of ['paidAmount', 'upcomingAmount', 'paidClasses', 'upcomingClasses', 'feeTotal', 'validityDays']) {
      if (b[n] !== undefined && b[n] !== null && b[n] !== '') {
        const v = Number(b[n]);
        if (!Number.isFinite(v) || v < 0) return badRequest(res, S.VALIDATION_FAILED);
      }
    }

    // Apply the whitelisted set (parity with the admin edit).
    for (const f of EDITABLE) {
      if (b[f] === undefined) continue;
      if (f === 'validityStart' || f === 'validityEnd') {
        s[f] = b[f] == null || b[f] === '' ? undefined : new Date(b[f]);
      } else if (['paidAmount', 'upcomingAmount', 'paidClasses', 'upcomingClasses', 'feeTotal', 'validityDays'].includes(f)) {
        s[f] = b[f] == null || b[f] === '' ? undefined : Math.round(Number(b[f]));
      } else if (f === 'remarks') {
        if (typeof b.remarks === 'string') s.remarks = b.remarks.trim() || undefined;
      } else if (['teacherId', 'batchId', 'instrumentId', 'classLevelId'].includes(f)) {
        s[f] = b[f] || undefined; // '' / null clears the ref
      } else {
        s[f] = b[f];
      }
    }

    // paymentStatus is derived — re-evaluate after any feeTotal/paidAmount change.
    s.paymentStatus = derivePaymentStatus(s.feeTotal, s.paidAmount, { forceFree: b.paymentStatus === 'free' });

    await s.save();

    // Keep batch studentCount consistent on (re)assignment.
    const newBatch = s.batchId ? String(s.batchId) : null;
    if (prevBatch !== newBatch) {
      if (prevBatch) await Batch.updateOne({ _id: prevBatch, institutionId: s.institutionId }, { $inc: { studentCount: -1 } });
      if (newBatch)  await Batch.updateOne({ _id: newBatch, institutionId: s.institutionId }, { $inc: { studentCount: 1 } });
    }

    const changes = diff(before, s.toObject(), [...EDITABLE, 'paymentStatus']);
    if (changes.length) {
      const onlyFees = changes.every(c => FEE_FIELDS.includes(c.field));
      await auditLog({
        institutionId: s.institutionId,
        ...actorFromReq(req),
        action:      onlyFees ? 'UPDATE_PAID_AMOUNT' : 'UPDATE_STUDENT',
        entityType:  'Student',
        entityId:    s._id,
        entityLabel: `Student: ${s.name}`,
        changes,
        ip:          req.ip,
      });
    }

    const fresh = await Student.findById(s._id).populate(DETAIL_POPULATE).lean();
    const att = await attendanceSummaryOf(fresh);
    return ok(res, S.STUDENT_UPDATED, detailOf(fresh, att));
  } catch (err) {
    next(err);
  }
};
