'use strict';

const Student    = require('../../../models/Student');
const Teacher    = require('../../../models/Teacher');
const Batch      = require('../../../models/Batch');
const Payment    = require('../../../models/Payment');
const Attendance = require('../../../models/Attendance');
const { ok } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin dashboard. GOLDEN RULE: every aggregate is $match-ed on
// req.institution._id. Feeds the stat cards, today's classes, the enrollment
// growth curve (12 months) and attendance health per batch (last 30 days).
// ─────────────────────────────────────────────────────────────────────────────

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function monthKey(d) { return d.toISOString().slice(0, 7); }

exports.get = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayKey = DAY_KEYS[now.getDay()];

    const [
      joinStatusAgg, teacherCount, activeBatches, feeAgg,
      todaysBatches, enrollAgg, baseCount, attendanceAgg,
    ] = await Promise.all([
      Student.aggregate([
        { $match: { institutionId: inst, status: 'active' } },
        { $group: { _id: '$joinStatus', c: { $sum: 1 } } },
      ]),
      Teacher.countDocuments({ institutionId: inst, status: 'active' }),
      Batch.countDocuments({ institutionId: inst, status: 'active' }),
      Payment.aggregate([
        { $match: { institutionId: inst, status: 'paid', paidAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Batch.find({ institutionId: inst, status: 'active' })
        .populate([
          { path: 'dayPatternId', select: 'days label' },
          { path: 'timeSlotId',   select: 'label startTime' },
          { path: 'teacherId',    select: 'name' },
        ]).lean(),
      Student.aggregate([
        { $match: { institutionId: inst, createdAt: { $gte: trendStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, c: { $sum: 1 } } },
      ]),
      Student.countDocuments({ institutionId: inst, createdAt: { $lt: trendStart } }),
      Attendance.aggregate([
        { $match: { institutionId: inst, date: { $gte: thirtyDaysAgo }, status: { $in: ['present', 'absent'] } } },
        { $group: { _id: { batchId: '$batchId', status: '$status' }, c: { $sum: 1 } } },
      ]),
    ]);

    const js = new Map(joinStatusAgg.map(x => [x._id, x.c]));
    const students = {
      total:      joinStatusAgg.reduce((n, x) => n + x.c, 0),
      trial:      js.get('trial') || 0,
      activeSoon: js.get('active_soon') || 0,
      active:     js.get('active') || 0,
      inactive:   js.get('inactive') || 0,
    };

    const todaysClasses = todaysBatches
      .filter(b => b.dayPatternId && Array.isArray(b.dayPatternId.days) && b.dayPatternId.days.includes(todayKey))
      .sort((a, b) => String(a.timeSlotId?.startTime || '').localeCompare(String(b.timeSlotId?.startTime || '')))
      .map(b => ({
        _id: String(b._id),
        name: b.name,
        time: b.timeSlotId ? b.timeSlotId.label : null,
        teacher: b.teacherId ? b.teacherId.name : null,
        studentCount: b.studentCount || 0,
      }));

    // Enrollment growth: new students per month + cumulative, last 12 months.
    const byMonth = new Map(enrollAgg.map(x => [x._id, x.c]));
    const enrollmentTrend = [];
    let cumulative = baseCount;
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = monthKey(m);
      const fresh = byMonth.get(key) || 0;
      cumulative += fresh;
      enrollmentTrend.push({ month: key, newStudents: fresh, cumulative });
    }

    // Attendance health: present rate per batch over the last 30 days.
    const att = new Map(); // batchId → { present, absent }
    for (const row of attendanceAgg) {
      const id = String(row._id.batchId);
      if (!att.has(id)) att.set(id, { present: 0, absent: 0 });
      att.get(id)[row._id.status] = row.c;
    }
    const batchNames = new Map(todaysBatches.map(b => [String(b._id), b.name]));
    const missing = [...att.keys()].filter(id => !batchNames.has(id));
    if (missing.length) {
      const extra = await Batch.find({ _id: { $in: missing }, institutionId: inst }).select('name').lean();
      for (const b of extra) batchNames.set(String(b._id), b.name);
    }
    const attendanceByBatch = [...att.entries()]
      .map(([batchId, m]) => {
        const total = m.present + m.absent;
        return {
          batchId,
          name: batchNames.get(batchId) || 'Batch',
          present: m.present,
          absent: m.absent,
          total,
          rate: total ? Math.round((m.present / total) * 100) : 0,
        };
      })
      .sort((a, b) => a.rate - b.rate);

    return ok(res, S.OK, {
      stats: {
        students,
        teachers: { active: teacherCount },
        batches:  { active: activeBatches },
        feesThisMonth: feeAgg.length ? feeAgg[0].total : 0,
      },
      todaysClasses,
      enrollmentTrend,
      attendanceByBatch,
    });
  } catch (err) {
    next(err);
  }
};
