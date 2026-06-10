'use strict';

const Batch      = require('../../../models/Batch');
const Student    = require('../../../models/Student');
const Attendance = require('../../../models/Attendance');
const Holiday    = require('../../../models/Holiday');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { emitToInstitution } = require('../../../config/socket');
const { ok, badRequest, notFound } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Attendance grid for a batch over a date window. GOLDEN RULE: batch, students,
// attendance and holidays are ALL filtered by req.institution._id.
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

function eachDay(from, to) {
  const out = [];
  const cur = new Date(dayKey(from));
  const end = new Date(dayKey(to));
  let guard = 0;
  while (cur <= end && guard < 400) { out.push(dayKey(cur)); cur.setUTCDate(cur.getUTCDate() + 1); guard++; }
  return out;
}

exports.grid = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { batchId, from, to } = req.query;
    if (!batchId) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await Batch.findOne({ _id: batchId, institutionId: inst }).select('name').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const range = {};
    if (from) range.$gte = new Date(from);
    if (to)   range.$lte = new Date(to);

    const attFilter = { institutionId: inst, batchId };
    if (from || to) attFilter.date = range;

    const [students, marks, holidays] = await Promise.all([
      Student.find({ institutionId: inst, batchId }).select('name displayId').sort({ name: 1 }).lean(),
      Attendance.find(attFilter).select('studentId date status').lean(),
      Holiday.find({ institutionId: inst, batchId, ...(from || to ? { date: range } : {}) }).select('date').lean(),
    ]);

    // Columns: explicit range if given, else the distinct dates that have marks.
    let dates;
    if (from && to) {
      dates = eachDay(from, to);
    } else {
      dates = [...new Set(marks.map(m => dayKey(m.date)))].sort();
    }
    const holidaySet = new Set(holidays.map(h => dayKey(h.date)));

    // studentId → { dateKey → status }
    const byStudent = new Map();
    for (const m of marks) {
      const sid = String(m.studentId);
      if (!byStudent.has(sid)) byStudent.set(sid, {});
      byStudent.get(sid)[dayKey(m.date)] = m.status;
    }

    const rows = students.map(s => {
      const sid = String(s._id);
      const recorded = byStudent.get(sid) || {};
      const marksByDate = {};
      for (const d of dates) {
        marksByDate[d] = recorded[d] || (holidaySet.has(d) ? 'holiday' : 'unmarked');
      }
      return {
        student: { _id: sid, name: s.name, displayId: s.displayId },
        marks: marksByDate,
      };
    });

    return ok(res, S.OK, { batch: { _id: String(batch._id), name: batch.name }, dates, rows });
  } catch (err) {
    next(err);
  }
};

// Admin correction path: upsert present/absent marks for a batch on a date.
// Mirrors the teacher markAttendance flow, minus the own-batch restriction —
// the admin may fix any batch in THEIR institution. Fully audited.
exports.mark = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { batchId, date, marks } = req.body || {};
    if (!batchId || !date || !Array.isArray(marks) || !marks.length) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await Batch.findOne({ _id: batchId, institutionId: inst }).select('name').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const when = new Date(dayKey(date));
    const stamp = { actorId: String(req.actor._id), actorRole: req.actor.role };

    let applied = 0;
    for (const m of marks) {
      if (!m || !m.studentId || !['present', 'absent'].includes(m.status)) continue;
      // Only students that actually belong to THIS batch in THIS institution.
      const belongs = await Student.exists({ _id: m.studentId, institutionId: inst, batchId });
      if (!belongs) continue;
      await Attendance.updateOne(
        { institutionId: inst, batchId, studentId: m.studentId, date: when },
        { $set: { status: m.status, markedBy: stamp } },
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

    emitToInstitution(String(inst), 'attendance:marked', { batchId: String(batchId), date: dayKey(date), count: applied });

    return ok(res, S.OK, { applied });
  } catch (err) {
    next(err);
  }
};

// Per-class roll-up for a batch: one row per marked date with present/absent
// counts (powers the batch Attendance tab; the grid endpoint serves the
// "view attendance" drill-down for a single date).
exports.batchSummary = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('name studentCount').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const agg = await Attendance.aggregate([
      { $match: { institutionId: inst, batchId: batch._id } },
      { $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, status: '$status' },
        c: { $sum: 1 },
      } },
    ]);

    const byDate = new Map(); // dateKey → { present, absent, holiday, credited }
    for (const row of agg) {
      const d = row._id.date;
      if (!byDate.has(d)) byDate.set(d, { present: 0, absent: 0, holiday: 0, credited: 0 });
      byDate.get(d)[row._id.status] = row.c;
    }

    const classes = [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, m]) => ({
        date,
        present: m.present,
        absent: m.absent,
        holiday: m.holiday,
        credited: m.credited,
        total: m.present + m.absent + m.holiday + m.credited,
      }));

    return ok(res, S.OK, {
      batch: { _id: String(batch._id), name: batch.name, studentCount: batch.studentCount || 0 },
      classes,
    });
  } catch (err) {
    next(err);
  }
};
