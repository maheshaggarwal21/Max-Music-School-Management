'use strict';

const Batch        = require('../models/Batch');
const Student      = require('../models/Student');
const Attendance   = require('../models/Attendance');
const ClassSession = require('../models/ClassSession');

// ─────────────────────────────────────────────────────────────────────────────
// Teacher KPI — the single source of truth for how a teacher's KPI % and 0–5
// performance rating are computed. Tweak the WEIGHTS / WINDOW here.
//
// COMPOSITE MODEL (0–1 each term, summed, ×100 → %):
//   • attendanceMarkedRate  (0.50) — discipline: of the class-days the teacher
//                                    was scheduled to run in the window, the
//                                    share where attendance was actually marked.
//   • sessionsLaunchedRate  (0.30) — delivery: of those scheduled class-days,
//                                    the share where a class session was launched.
//   • activeStudentRetention(0.20) — outcome: active students ÷ total students
//                                    across the teacher's batches.
//
//   kpiPercent  = round( (0.50·att + 0.30·sess + 0.20·ret) · 100 )
//   performance = round( kpi01 · 5 , 1 )           // 0.0 – 5.0 "global rating"
//
// A teacher with no schedule/students yet scores 0 (matches a fresh roster).
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = { attendance: 0.5, sessions: 0.3, retention: 0.2 };
const WINDOW_DAYS = 30;

// dayPattern.days use lowercase 3-letter codes; map to JS Date.getDay() (0=Sun).
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function startOfDay(d) { return new Date(new Date(d).toISOString().slice(0, 10)); }

// Count, in [from, to] inclusive, how many dates fall on one of `days`.
function scheduledDaysInWindow(days, from, to) {
  if (!Array.isArray(days) || !days.length) return 0;
  const wanted = new Set(days.map((d) => DOW[String(d).toLowerCase().slice(0, 3)]).filter((n) => n != null));
  if (!wanted.size) return 0;
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (wanted.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

/**
 * Compute KPI for ONE teacher within an institution.
 * Returns { kpiPercent (0–100 int), performance (0.0–5.0), breakdown }.
 */
async function computeTeacherKpi(institutionId, teacherId) {
  const today = startOfDay(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - WINDOW_DAYS);

  const batches = await Batch.find({ institutionId, teacherId })
    .populate({ path: 'dayPatternId', select: 'days' })
    .select('dayPatternId')
    .lean();

  const batchIds = batches.map((b) => b._id);

  // Scheduled class-days over the last WINDOW_DAYS across all the teacher's
  // batches — the denominator the attendance/session queries are measured against.
  let scheduledCount = 0;
  for (const b of batches) {
    scheduledCount += scheduledDaysInWindow(b.dayPatternId && b.dayPatternId.days, from, today);
  }

  const [sessionsCount, attendanceDayGroups, students] = await Promise.all([
    batchIds.length
      ? ClassSession.countDocuments({ institutionId, batchId: { $in: batchIds }, targetDate: { $gte: from, $lte: today } })
      : 0,
    batchIds.length
      ? Attendance.aggregate([
          { $match: { institutionId, batchId: { $in: batchIds }, date: { $gte: from, $lte: today } } },
          { $group: { _id: { batchId: '$batchId', date: '$date' } } },
          { $count: 'n' },
        ])
      : [],
    batchIds.length
      ? Student.find({ institutionId, batchId: { $in: batchIds } }).select('joinStatus status').lean()
      : [],
  ]);

  const attendanceDays = attendanceDayGroups[0] ? attendanceDayGroups[0].n : 0;
  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.joinStatus === 'active').length;

  const attendanceMarkedRate = scheduledCount ? clamp01(attendanceDays / scheduledCount) : 0;
  const sessionsLaunchedRate = scheduledCount ? clamp01(sessionsCount / scheduledCount) : 0;
  const activeStudentRetention = totalStudents ? clamp01(activeStudents / totalStudents) : 0;

  const kpi01 = clamp01(
    WEIGHTS.attendance * attendanceMarkedRate +
    WEIGHTS.sessions * sessionsLaunchedRate +
    WEIGHTS.retention * activeStudentRetention
  );

  return {
    kpiPercent: Math.round(kpi01 * 100),
    performance: Math.round(kpi01 * 5 * 10) / 10,
    breakdown: {
      attendanceMarkedRate: Math.round(attendanceMarkedRate * 100),
      sessionsLaunchedRate: Math.round(sessionsLaunchedRate * 100),
      activeStudentRetention: Math.round(activeStudentRetention * 100),
      scheduledCount,
      sessionsCount,
      attendanceDays,
      totalStudents,
      activeStudents,
      windowDays: WINDOW_DAYS,
    },
  };
}

/** Compute KPI for many teachers (concurrently). Returns Map<teacherIdStr, kpi>. */
async function computeKpiMap(institutionId, teacherIds) {
  const entries = await Promise.all(
    teacherIds.map(async (id) => [String(id), await computeTeacherKpi(institutionId, id)])
  );
  return new Map(entries);
}

module.exports = { computeTeacherKpi, computeKpiMap, WEIGHTS, WINDOW_DAYS };
