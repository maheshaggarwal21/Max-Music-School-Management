'use strict';

const Batch        = require('../../../models/Batch');
const Student      = require('../../../models/Student');
const Attendance   = require('../../../models/Attendance');
const Holiday      = require('../../../models/Holiday');
const Teacher      = require('../../../models/Teacher');
const ClassSession = require('../../../models/ClassSession');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { emitToInstitution } = require('../../../config/socket');
const { brandingPublic } = require('../../../config/instAuthHelpers');
const { computeKpiMap, computeTeacherKpi } = require('../../../config/teacherKpi');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Teacher panel. Actor is the teacher (req.actor._id). DOUBLE scope: every query
// is filtered by req.institution._id AND, where it concerns the teacher's own
// work, by teacherId = req.actor._id. A teacher only ever sees their own batches.
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }
function dayStart(d) { return new Date(dayKey(d)); }

const BATCH_POPULATE = [
  { path: 'instrumentId', select: 'name' },
  { path: 'dayPatternId', select: 'label days' },
  { path: 'timeSlotId',   select: 'label' },
];

function batchRow(b) {
  return {
    _id:  String(b._id),
    name: b.name,
    instrument: b.instrumentId ? { _id: String(b.instrumentId._id), name: b.instrumentId.name } : null,
    dayPattern: b.dayPatternId ? { _id: String(b.dayPatternId._id), label: b.dayPatternId.label } : null,
    timeSlot:   b.timeSlotId ? { _id: String(b.timeSlotId._id), label: b.timeSlotId.label } : null,
    studentCount: b.studentCount || 0,
    status: b.status,
  };
}

// Confirm the batch is in this institution AND owned by the acting teacher.
async function ownBatch(req, batchId) {
  return Batch.findOne({ _id: batchId, institutionId: req.institution._id, teacherId: req.actor._id });
}

exports.me = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const [teacher, activeBatches] = await Promise.all([
      Teacher.findOne({ _id: req.actor._id, institutionId: inst }).lean(),
      Batch.countDocuments({ institutionId: inst, teacherId: req.actor._id, status: 'active' }),
    ]);
    if (!teacher) return notFound(res, S.TEACHER_NOT_FOUND);
    return ok(res, S.OK, {
      teacher: {
        _id: String(teacher._id), displayId: teacher.displayId, name: teacher.name,
        email: teacher.email, mobile: teacher.mobile,
        mobileVerified: !!teacher.mobileVerified,
        status: teacher.status, activeBatches,
      },
      institution: brandingPublic(req.institution),
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /teacher/me — a teacher updates their own contact details (email/mobile).
// Scoped to req.actor: a teacher can only ever edit their own record.
exports.updateMe = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    const mobile = String((req.body && req.body.mobile) || '').trim();
    if (!email || !mobile) return badRequest(res, S.VALIDATION_FAILED);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest(res, S.VALIDATION_FAILED);
    if (!/^\d{10}$/.test(mobile)) return badRequest(res, S.VALIDATION_FAILED);

    const teacher = await Teacher.findOne({ _id: req.actor._id, institutionId: inst });
    if (!teacher) return notFound(res, S.TEACHER_NOT_FOUND);

    // Email is unique per institution — never let one teacher take another's email.
    if (email !== teacher.email) {
      const clash = await Teacher.exists({ institutionId: inst, email, _id: { $ne: teacher._id } });
      if (clash) return badRequest(res, 'That email is already in use');
    }

    const changes = [];
    if (teacher.email !== email)   changes.push({ field: 'email',  from: teacher.email,  to: email });
    if (teacher.mobile !== mobile) changes.push({ field: 'mobile', from: teacher.mobile, to: mobile });

    if (changes.length) {
      // A changed mobile is an UNPROVEN number — verification must be redone
      // before OTP login works on it, or codes would go to an unverified phone.
      if (teacher.mobile !== mobile) teacher.mobileVerified = false;
      teacher.email = email;
      teacher.mobile = mobile;
      await teacher.save();
      await auditLog({
        institutionId: inst, ...actorFromReq(req),
        action: 'UPDATE_TEACHER_PROFILE', entityType: 'Teacher', entityId: teacher._id,
        entityLabel: `Teacher: ${teacher.name}`, changes, ip: req.ip,
      });
    }

    return ok(res, S.OK, null);
  } catch (err) {
    next(err);
  }
};

exports.myBatches = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const filter = { institutionId: inst, teacherId: req.actor._id };
    const { day } = req.query;

    let batches = await Batch.find(filter).populate(BATCH_POPULATE).sort({ createdAt: -1 }).lean();
    if (day) batches = batches.filter(b => b.dayPatternId && Array.isArray(b.dayPatternId.days) && b.dayPatternId.days.includes(day));
    // Contract (CONTRACTS.md): teacher GET /batches → BatchRow[] (bare array).
    return ok(res, S.OK, batches.map(batchRow));
  } catch (err) {
    next(err);
  }
};

exports.batchStudents = async (req, res, next) => {
  try {
    const batch = await ownBatch(req, req.params.id);
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const students = await Student
      .find({ institutionId: req.institution._id, batchId: batch._id })
      .select('displayId name mobile joinStatus validityEnd').sort({ name: 1 }).lean();

    // Contract (CONTRACTS.md): GET /batches/:id/students → StudentRow[] (bare array).
    return ok(res, S.OK, students.map(s => ({
      _id: String(s._id), displayId: s.displayId, name: s.name, mobile: s.mobile,
      joinStatus: s.joinStatus, validityEnd: s.validityEnd || null,
    })));
  } catch (err) {
    next(err);
  }
};

exports.getAttendance = async (req, res, next) => {
  try {
    const { batchId, date } = req.query;
    if (!batchId || !date) return badRequest(res, S.VALIDATION_FAILED);
    const batch = await ownBatch(req, batchId);
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const marks = await Attendance
      .find({ institutionId: req.institution._id, batchId, date: dayStart(date) })
      .select('studentId status').lean();

    // Frontend indexes marks[studentId], so return a studentId→status object map.
    return ok(res, S.OK, {
      date: dayKey(date),
      marks: Object.fromEntries(marks.map(m => [String(m.studentId), m.status])),
    });
  } catch (err) {
    next(err);
  }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { batchId, date, marks } = req.body || {};
    if (!batchId || !date || !Array.isArray(marks) || !marks.length) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await ownBatch(req, batchId);
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const when = dayStart(date);
    const stamp = { actorId: String(req.actor._id), actorRole: req.actor.role };

    let applied = 0;
    for (const m of marks) {
      if (!m || !m.studentId || !['present', 'absent'].includes(m.status)) continue;
      // Only students that actually belong to THIS batch in THIS institution.
      const belongs = await Student.exists({ _id: m.studentId, institutionId: inst, batchId });
      if (!belongs) continue;
      await Attendance.updateOne(
        { institutionId: inst, batchId, studentId: m.studentId, date: when },
        { $set: { status: m.status, teacherId: req.actor._id, markedBy: stamp } },
        { upsert: true }
      );
      applied++;
    }

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'MARK_ATTENDANCE', entityType: 'Batch', entityId: batch._id,
      entityLabel: `Attendance: ${batch.name} ${dayKey(date)}`,
      changes: [{ field: 'marks', from: null, to: applied }], ip: req.ip,
    });

    // Live update to the institution room (no-op until Phase 7 wires Socket.io).
    emitToInstitution(String(inst), 'attendance:marked', { batchId: String(batchId), date: dayKey(date), count: applied });

    return ok(res, S.OK, { applied });
  } catch (err) {
    next(err);
  }
};

exports.listHolidays = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    // Only holidays for the teacher's own batches.
    const myBatchIds = await Batch.find({ institutionId: inst, teacherId: req.actor._id }).distinct('_id');
    const holidays = await Holiday.find({ institutionId: inst, batchId: { $in: myBatchIds } })
      .populate({ path: 'batchId', select: 'name' }).sort({ date: -1 }).lean();

    // Contract (CONTRACTS.md): GET /holidays → HolidayItem[] (bare array).
    return ok(res, S.OK, holidays.map(h => ({
      _id: String(h._id),
      batch: h.batchId ? { _id: String(h.batchId._id), name: h.batchId.name } : null,
      date: h.date, studentCategory: h.studentCategory, reason: h.reason || null,
    })));
  } catch (err) {
    next(err);
  }
};

exports.declareHoliday = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { batchId, date, studentCategory, reason } = req.body || {};
    if (!batchId || !date || !['regular', 'trial'].includes(studentCategory)) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await ownBatch(req, batchId);
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const holiday = await Holiday.create({
      institutionId: inst, batchId, date: dayStart(date), studentCategory,
      reason: reason || undefined, creditsApplied: true,
      createdBy: { actorId: String(req.actor._id), actorRole: req.actor.role },
    });

    // Credit one class back to matching-category students in this batch.
    await Student.updateMany(
      { institutionId: inst, batchId, category: studentCategory },
      { $inc: { paidClasses: 1 } }
    );

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'CREATE_HOLIDAY', entityType: 'Holiday', entityId: holiday._id,
      entityLabel: `Holiday: ${batch.name} ${dayKey(date)}`, ip: req.ip,
    });

    // Contract (CONTRACTS.md): POST /holidays → HolidayItem (bare object).
    return created(res, S.CREATED, {
      _id: String(holiday._id), batch: { _id: String(batch._id), name: batch.name },
      date: holiday.date, studentCategory: holiday.studentCategory, reason: holiday.reason || null,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const holiday = await Holiday.findOne({ _id: req.params.id, institutionId: inst });
    if (!holiday) return notFound(res, S.NOT_FOUND);
    // Must belong to one of the teacher's own batches.
    const owns = await Batch.exists({ _id: holiday.batchId, institutionId: inst, teacherId: req.actor._id });
    if (!owns) return notFound(res, S.NOT_FOUND);

    // Reverse the credit if it was applied.
    if (holiday.creditsApplied) {
      await Student.updateMany(
        { institutionId: inst, batchId: holiday.batchId, category: holiday.studentCategory },
        { $inc: { paidClasses: -1 } }
      );
    }
    await Holiday.deleteOne({ _id: holiday._id, institutionId: inst });

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'DELETE_HOLIDAY', entityType: 'Holiday', entityId: holiday._id,
      entityLabel: `Holiday: ${dayKey(holiday.date)}`, ip: req.ip,
    });

    return ok(res, S.DELETED, null);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Teachers roster + KPIs. DECISION: every teacher in the institution may view
// colleagues and open their class schedule (institution-scoped, not self-scoped).
// Salary is NEVER exposed here — only KPI %, 0–5 performance, and status.
// ─────────────────────────────────────────────────────────────────────────────
exports.listColleagues = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const teachers = await Teacher.find({ institutionId: inst })
      .select('displayId name email mobile status isOwner createdAt')
      .sort({ createdAt: 1 }).lean();

    const kpiMap = await computeKpiMap(inst, teachers.map(t => t._id));

    const items = teachers.map(t => {
      const kpi = kpiMap.get(String(t._id)) || { kpiPercent: 0, performance: 0 };
      return {
        _id: String(t._id),
        displayId: t.displayId,
        name: t.name,
        email: t.email,
        mobile: t.mobile,
        status: t.status,
        role: t.isOwner ? 'owner' : 'staff',
        since: t.createdAt,
        kpiPercent: kpi.kpiPercent,
        performance: kpi.performance,
      };
    });
    return ok(res, S.OK, items);
  } catch (err) {
    next(err);
  }
};

// A colleague's class schedule — their batches as launchable rows. Optional
// ?date=YYYY-MM-DD marks which batches already have a session that day.
exports.colleagueSchedule = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const teacher = await Teacher.findOne({ _id: req.params.id, institutionId: inst })
      .select('displayId name status').lean();
    if (!teacher) return notFound(res, S.TEACHER_NOT_FOUND);

    const date = req.query.date ? dayStart(req.query.date) : null;
    const batches = await Batch.find({ institutionId: inst, teacherId: teacher._id })
      .populate(BATCH_POPULATE).sort({ createdAt: -1 }).lean();

    let launched = new Set();
    if (date && batches.length) {
      const next = new Date(date); next.setDate(next.getDate() + 1);
      const sessions = await ClassSession.find({
        institutionId: inst,
        batchId: { $in: batches.map(b => b._id) },
        targetDate: { $gte: date, $lt: next },
      }).select('batchId').lean();
      launched = new Set(sessions.map(s => String(s.batchId)));
    }

    const rows = batches.map(b => ({ ...batchRow(b), launched: launched.has(String(b._id)) }));
    return ok(res, S.OK, {
      teacher: { _id: String(teacher._id), name: teacher.name, displayId: teacher.displayId, status: teacher.status },
      date: date ? dayKey(date) : null,
      rows,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Class sessions (batch Overview tab "Launch Session" + archive). Institution-
// scoped batch lookup so any teacher may launch any colleague's class.
// ─────────────────────────────────────────────────────────────────────────────
function sessionRow(s) {
  return {
    _id: String(s._id),
    meetingUrl: s.meetingUrl,
    targetDate: s.targetDate,
    launchedAt: s.createdAt,
    launchedBy: s.launchedBy ? { actorRole: s.launchedBy.actorRole } : null,
  };
}

exports.batchInfo = async (req, res, next) => {
  try {
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: req.institution._id })
      .populate(BATCH_POPULATE).lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);
    return ok(res, S.OK, batchRow(batch));
  } catch (err) {
    next(err);
  }
};

exports.listSessions = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('_id').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const result = await ClassSession.paginate(
      { institutionId: inst, batchId: batch._id },
      { page, limit, sort: { targetDate: -1, createdAt: -1 }, lean: true }
    );
    return ok(res, S.OK, paginated(result.docs.map(sessionRow), result));
  } catch (err) {
    next(err);
  }
};

exports.launchSession = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { meetingUrl, targetDate } = req.body || {};
    if (!meetingUrl || !String(meetingUrl).trim()) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('name teacherId').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    let url;
    try {
      url = new URL(String(meetingUrl).trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    } catch {
      return badRequest(res, S.VALIDATION_FAILED);
    }
    const when = targetDate ? new Date(targetDate) : new Date();
    if (Number.isNaN(when.getTime())) return badRequest(res, S.VALIDATION_FAILED);

    const session = await ClassSession.create({
      institutionId: inst,
      batchId: batch._id,
      teacherId: batch.teacherId || undefined,
      meetingUrl: url.toString(),
      targetDate: when,
      launchedBy: { actorId: String(req.actor._id), actorRole: req.actor.role },
    });

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'LAUNCH_SESSION', entityType: 'ClassSession', entityId: session._id,
      entityLabel: `Session: ${batch.name} ${dayKey(when)}`, ip: req.ip,
    });

    emitToInstitution(String(inst), 'session:launched', { batchId: String(batch._id), targetDate: dayKey(when) });

    return created(res, S.SESSION_LAUNCHED, sessionRow(session));
  } catch (err) {
    next(err);
  }
};
