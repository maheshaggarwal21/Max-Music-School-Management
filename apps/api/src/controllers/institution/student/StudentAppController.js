'use strict';

const Student    = require('../../../models/Student');
const Batch      = require('../../../models/Batch');
const Attendance = require('../../../models/Attendance');
const Holiday    = require('../../../models/Holiday');
const { brandingPublic } = require('../../../config/instAuthHelpers');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Student panel. Actor is the student (req.actor._id). Every query is scoped to
// req.institution._id AND studentId = req.actor._id — a student only ever sees
// their own data. Responses expose ONLY brandingPublic; NO Max Music identifiers.
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

// DayPattern.days values ('mon'..'sun') → JS getUTCDay() (Sun=0..Sat=6).
const JS_DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

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

// Soonest date (YYYY-MM-DD) on/after `from` whose weekday is in the pattern, else null.
function nextClassDate(days, from) {
  const wanted = new Set((days || []).map(d => JS_DOW[d]).filter(n => n !== undefined));
  if (wanted.size === 0) return null;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i < 14; i++) {
    if (wanted.has(d.getUTCDay())) return d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

exports.me = async (req, res, next) => {
  try {
    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    return ok(res, S.OK, {
      student: {
        _id: String(s._id), displayId: s.displayId, name: s.name, mobile: s.mobile,
        mobileVerified: !!s.mobileVerified,
        email: s.email || null,
        guardianName: s.guardianName || null,
        guardianMobile: s.guardianMobile || null,
        instrument: s.instrumentId ? s.instrumentId.name : null,
        joinStatus: s.joinStatus, validityEnd: s.validityEnd || null,
      },
      institution: brandingPublic(req.institution),
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /me → limited profile fields (CONTRACTS.md). A student may edit only their
// own email + guardian contact; identity fields (name/mobile/fees/batch) are admin-only.
exports.updateMe = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const b = req.body || {};
    const email          = b.email          == null ? null : String(b.email).toLowerCase().trim();
    const guardianName   = b.guardianName   == null ? null : String(b.guardianName).trim();
    const guardianMobile = b.guardianMobile == null ? null : String(b.guardianMobile).trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest(res, S.VALIDATION_FAILED);
    if (guardianMobile && !/^\d{10}$/.test(guardianMobile)) return badRequest(res, S.VALIDATION_FAILED);

    const student = await Student.findOne({ _id: req.actor._id, institutionId: inst });
    if (!student) return notFound(res, S.STUDENT_NOT_FOUND);

    const changes = [];
    const set = (field, next) => {
      const cur = student[field] || null;
      const val = next || null;
      if (cur !== val) { changes.push({ field, from: cur, to: val }); student[field] = val; }
    };
    set('email', email);
    set('guardianName', guardianName);
    set('guardianMobile', guardianMobile);

    if (changes.length) {
      await student.save();
      await auditLog({
        institutionId: inst, ...actorFromReq(req),
        action: 'UPDATE_STUDENT_PROFILE', entityType: 'Student', entityId: student._id,
        entityLabel: `Student: ${student.name}`, changes, ip: req.ip,
      });
    }

    return ok(res, S.OK, null);
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

    // upcomingClass must be a ClassItem (CONTRACTS.md): { date, batchName, time, status }.
    const upcomingDate = (s.batchId && s.batchId.dayPatternId)
      ? nextClassDate(s.batchId.dayPatternId.days, new Date())
      : null;

    return ok(res, S.OK, {
      upcomingClass: upcomingDate
        ? { date: upcomingDate, batchName: sched.batchName, time: sched.time, status: 'upcoming' }
        : null,
      // holidayNotice is a string|null per the contract — not an object.
      holidayNotice: nextHoliday
        ? `${nextHoliday.reason || 'Holiday'} — ${dayKey(nextHoliday.date)}`
        : null,
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

// GET /timetable → ClassItem[] (CONTRACTS.md): a bare, dated array. We project the
// batch's recurring day-pattern onto actual dates across a 6-week window (last week
// → +5 weeks, so the panel's prev/this/next-week nav always has data), folding in
// declared holidays and the student's own attendance for past dates.
exports.timetable = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const s = await loadSelf(req);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    if (!s.batchId || !s.batchId.dayPatternId) return ok(res, S.OK, []);

    const sched = scheduleOf(s);
    const wanted = new Set(
      (s.batchId.dayPatternId.days || []).map(d => JS_DOW[d]).filter(n => n !== undefined)
    );
    if (wanted.size === 0) return ok(res, S.OK, []);

    // Window anchored on the Monday of last week, in UTC (matches how dates are stored).
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 42); // 6 weeks

    const [holidays, attendance] = await Promise.all([
      Holiday.find({ institutionId: inst, batchId: s.batchId._id, date: { $gte: start, $lt: end } })
        .select('date').lean(),
      Attendance.find({ institutionId: inst, studentId: s._id, date: { $gte: start, $lt: end } })
        .select('date status').lean(),
    ]);
    const holidaySet = new Set(holidays.map(h => dayKey(h.date)));
    const attMap = new Map(attendance.map(a => [dayKey(a.date), a.status]));

    const timetable = [];
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (!wanted.has(d.getUTCDay())) continue;
      const key = d.toISOString().slice(0, 10);
      let status = 'upcoming';
      if (holidaySet.has(key)) status = 'holiday';
      else if (attMap.has(key)) {
        const a = attMap.get(key);
        status = a === 'credited' ? 'holiday' : a; // credited shows as a holiday-credit
      }
      timetable.push({ date: key, batchName: sched.batchName, time: sched.time, status });
    }
    return ok(res, S.OK, timetable);
  } catch (err) {
    next(err);
  }
};
