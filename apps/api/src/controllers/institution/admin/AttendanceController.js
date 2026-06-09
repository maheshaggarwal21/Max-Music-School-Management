'use strict';

const Batch      = require('../../../models/Batch');
const Student    = require('../../../models/Student');
const Attendance = require('../../../models/Attendance');
const Holiday    = require('../../../models/Holiday');
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
