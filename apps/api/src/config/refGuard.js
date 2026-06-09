'use strict';

const Teacher    = require('../models/Teacher');
const Batch      = require('../models/Batch');
const Instrument = require('../models/Instrument');

// ─────────────────────────────────────────────────────────────────────────────
// Cross-institution reference guard (GOLDEN RULE). A student's teacher/batch/
// instrument refs come from the client; before persisting them we MUST confirm
// each belongs to the SAME institution, or a foreign id leaks data through
// populate. Returns true if every provided ref is in `inst` (or absent).
// ─────────────────────────────────────────────────────────────────────────────
async function studentRefsValid(inst, { teacherId, batchId, instrumentId } = {}) {
  const checks = [];
  if (teacherId)    checks.push(Teacher.exists({ _id: teacherId, institutionId: inst }));
  if (batchId)      checks.push(Batch.exists({ _id: batchId, institutionId: inst }));
  if (instrumentId) checks.push(Instrument.exists({ _id: instrumentId, institutionId: inst }));
  if (!checks.length) return true;
  return (await Promise.all(checks)).every(Boolean);
}

module.exports = { studentRefsValid };
