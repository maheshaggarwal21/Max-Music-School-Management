'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — node-cron daily maintenance. Runs as the SYSTEM actor (matches the
// product's "changed BY SYSTEM" audit trail). Three jobs:
//   1. active_soon → active once validityStart has arrived  (ADVANCE_STUDENT_STATUS)
//   2. validity expired → inactive                          (EXPIRE_VALIDITY)
//   3. pending rent invoices past dueDate → overdue
// Each per-student transition is audited individually so it appears in that
// student's activity feed. Audit is fire-and-forget (w:0) and never blocks.
// ─────────────────────────────────────────────────────────────────────────────

const cron = require('node-cron');
const Student = require('../models/Student');
const RentInvoice = require('../models/RentInvoice');
const { auditLog } = require('./auditLog');
const S = require('./strings');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const SYSTEM_ACTOR = { actorId: 'system', actorRole: 'system', actorName: 'System' };

// active_soon → active once the validity window has opened.
async function advanceJoinStatus() {
  const today = startOfToday();
  const due = await Student.find({
    joinStatus: 'active_soon',
    validityStart: { $lte: today },
    status: 'active',
  }).select('institutionId name').lean();

  for (const s of due) {
    await Student.updateOne({ _id: s._id }, { $set: { joinStatus: 'active' } });
    await auditLog({
      institutionId: s.institutionId, ...SYSTEM_ACTOR,
      action: S.ACTIONS.ADVANCE_STUDENT_STATUS,
      entityType: 'Student', entityId: s._id, entityLabel: `Student: ${s.name}`,
      changes: [{ field: 'joinStatus', from: 'active_soon', to: 'active' }],
    });
  }
  return due.length;
}

// Validity expired → inactive (both joinStatus and status).
async function expireValidity() {
  const today = startOfToday();
  const expired = await Student.find({
    validityEnd: { $lt: today, $ne: null },
    joinStatus: { $ne: 'inactive' },
    status: { $ne: 'hold' }, // held students (e.g. partial payment) are not auto-expired
  }).select('institutionId name joinStatus').lean();

  for (const s of expired) {
    await Student.updateOne({ _id: s._id }, { $set: { joinStatus: 'inactive', status: 'inactive' } });
    await auditLog({
      institutionId: s.institutionId, ...SYSTEM_ACTOR,
      action: S.ACTIONS.EXPIRE_VALIDITY,
      entityType: 'Student', entityId: s._id, entityLabel: `Student: ${s.name}`,
      changes: [{ field: 'joinStatus', from: s.joinStatus, to: 'inactive' }],
    });
  }
  return expired.length;
}

// Pending rent invoices past their due date → overdue (operator-facing).
async function flagOverdueRent() {
  const now = new Date();
  const result = await RentInvoice.updateMany(
    { status: 'pending', dueDate: { $lt: now } },
    { $set: { status: 'overdue' } }
  );
  return result.modifiedCount || 0;
}

async function runDailyMaintenance() {
  const advanced = await advanceJoinStatus();
  const expired = await expireValidity();
  const rentOverdue = await flagOverdueRent();
  console.log(`[cron] daily maintenance: advanced=${advanced} expired=${expired} rentOverdue=${rentOverdue}`);
  return { advanced, expired, rentOverdue };
}

function init() {
  const tz = process.env.CRON_TZ || 'Asia/Kolkata';
  // 00:05 local — just after midnight so a day's expiries land on the right date.
  cron.schedule(
    '5 0 * * *',
    () => { runDailyMaintenance().catch(err => console.error('[cron] daily maintenance failed', err.message)); },
    { timezone: tz }
  );
  console.log(`[cron] scheduled daily maintenance at 00:05 ${tz}`);
}

module.exports = { init, runDailyMaintenance, advanceJoinStatus, expireValidity, flagOverdueRent };
