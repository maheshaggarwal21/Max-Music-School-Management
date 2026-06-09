'use strict';

const Student    = require('../../../models/Student');
const Batch      = require('../../../models/Batch');
const Attendance = require('../../../models/Attendance');
const Holiday    = require('../../../models/Holiday');
const { brandingPublic } = require('../../../config/instAuthHelpers');
const { ok, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Student panel. Actor is the student (req.actor._id). Every query is scoped to
// req.institution._id AND studentId = req.actor._id — a student only ever sees
// their own data. Responses expose ONLY brandingPublic; NO Max Music identifiers.
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

const SELF_POPULATE = [
  { path: 'instrumentId', select: 'name' },
  { path: 'batchId', select: 'name dayPatternId timeSlotId', populate: [
    { path: 'dayPatternId', select: 'label days' },
    { path: 'timeSlotId',   select: 'label' },
  ] },
];

async function loadSelf(req) {
  return Student.findOne({ _id: req.actor._id, institutionId: req.institution._id })
    .populate(SELF_POPULATE).lean();
}

function scheduleOf(s) {
  const b = s.batchId;
  return {
    batchName: b ? b.name : null,
    days: (b && b.dayPatternId) ? b.dayPatternId.label : null,
    time: (b && b.timeSlotId) ? b.timeSlotId.label : null,
  };
}

exports.me = async (req, res, next) => {
  try {
    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    return ok(res, S.OK, {
      student: {
        _id: String(s._id), displayId: s.displayId, name: s.name, mobile: s.mobile,
        instrument: s.instrumentId ? s.instrumentId.name : null,
        joinStatus: s.joinStatus, validityEnd: s.validityEnd || null,
      },
      institution: brandingPublic(req.institution),
    });
  } catch (err) {
    next(err);
  }
};

exports.dashboard = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);

    const sched = scheduleOf(s);
    const todayStart = new Date(dayKey(new Date()));

    const [attAgg, nextHoliday] = await Promise.all([
      Attendance.aggregate([
        { $match: { institutionId: s.institutionId, studentId: s._id } },
        { $group: { _id: '$status', c: { $sum: 1 } } },
      ]),
      s.batchId
        ? Holiday.findOne({ institutionId: inst, batchId: s.batchId._id, date: { $gte: todayStart } })
            .sort({ date: 1 }).lean()
        : null,
    ]);

    const am = new Map(attAgg.map(x => [x._id, x.c]));
    const present = am.get('present') || 0;
    const absent  = am.get('absent') || 0;
    const total   = present + absent;
    const percent = total ? Math.round((present / total) * 100) : 0;

    return ok(res, S.OK, {
      upcomingClass: s.batchId ? { batchName: sched.batchName, time: sched.time, days: sched.days } : null,
      holidayNotice: nextHoliday ? { date: nextHoliday.date, reason: nextHoliday.reason || null } : null,
      attendance: { percent, present, total },
      credentials: { displayId: s.displayId, schedule: sched.days, sessionSlot: sched.time },
      validity: { start: s.validityStart || null, end: s.validityEnd || null, paidClasses: s.paidClasses || 0 },
    });
  } catch (err) {
    next(err);
  }
};

exports.classes = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    const batchName = s.batchId ? s.batchId.name : null;
    const time = (s.batchId && s.batchId.timeSlotId) ? s.batchId.timeSlotId.label : null;

    const result = await Attendance.paginate(
      { institutionId: inst, studentId: s._id },
      { page, limit, sort: { date: -1 }, lean: true }
    );

    const items = result.docs.map(a => ({
      date: dayKey(a.date),
      batchName,
      time,
      status: a.status === 'credited' ? 'holiday' : a.status,  // credited shows as holiday-credit
    }));
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};

exports.timetable = async (req, res, next) => {
  try {
    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    if (!s.batchId) return ok(res, S.OK, { timetable: [] });

    const sched = scheduleOf(s);
    const days = (s.batchId.dayPatternId && s.batchId.dayPatternId.days) || [];
    const timetable = days.map(d => ({
      day: d, batchName: sched.batchName, time: sched.time, status: 'upcoming',
    }));
    return ok(res, S.OK, { timetable });
  } catch (err) {
    next(err);
  }
};
