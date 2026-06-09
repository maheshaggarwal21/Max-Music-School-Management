'use strict';

const Batch      = require('../../../models/Batch');
const Student    = require('../../../models/Student');
const Attendance = require('../../../models/Attendance');
const Holiday    = require('../../../models/Holiday');
const Teacher    = require('../../../models/Teacher');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { emitToInstitution } = require('../../../config/socket');
const { brandingPublic } = require('../../../config/instAuthHelpers');
const { ok, created, badRequest, notFound } = require('../../../config/helper');
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
        email: teacher.email, mobile: teacher.mobile, status: teacher.status, activeBatches,
      },
      institution: brandingPublic(req.institution),
    });
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
    return ok(res, S.OK, { batches: batches.map(batchRow) });
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

    return ok(res, S.OK, {
      students: students.map(s => ({
        _id: String(s._id), displayId: s.displayId, name: s.name, mobile: s.mobile,
        joinStatus: s.joinStatus, validityEnd: s.validityEnd || null,
      })),
    });
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

    return ok(res, S.OK, {
      date: dayKey(date),
      marks: marks.map(m => ({ studentId: String(m.studentId), status: m.status })),
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

    return ok(res, S.OK, {
      holidays: holidays.map(h => ({
        _id: String(h._id),
        batch: h.batchId ? { _id: String(h.batchId._id), name: h.batchId.name } : null,
        date: h.date, studentCategory: h.studentCategory, reason: h.reason || null,
      })),
    });
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

    return created(res, S.CREATED, {
      holiday: {
        _id: String(holiday._id), batch: { _id: String(batch._id), name: batch.name },
        date: holiday.date, studentCategory: holiday.studentCategory, reason: holiday.reason || null,
      },
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
