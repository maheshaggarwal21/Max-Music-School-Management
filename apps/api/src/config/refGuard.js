'use strict';

const mongoose   = require('mongoose');
const Teacher    = require('../models/Teacher');
const Batch      = require('../models/Batch');
const Instrument = require('../models/Instrument');
const ClassLevel = require('../models/ClassLevel');

// ─────────────────────────────────────────────────────────────────────────────
// Cross-institution reference guard (GOLDEN RULE). A student's teacher/batch/
// instrument/classLevel refs come from the client; before persisting them we MUST
// confirm each belongs to the SAME institution, or a foreign id leaks data through
// populate. Returns true if every provided ref is in `inst` (or absent).
// A malformed (non-ObjectId) ref is treated as invalid → false (never CastError).
// ─────────────────────────────────────────────────────────────────────────────
async function studentRefsValid(inst, { teacherId, batchId, instrumentId, classLevelId } = {}) {
  const provided = [teacherId, batchId, instrumentId, classLevelId].filter(Boolean);
  if (provided.some(id => !mongoose.isValidObjectId(id))) return false;

  const checks = [];
  if (teacherId)    checks.push(Teacher.exists({ _id: teacherId, institutionId: inst }));
  if (batchId)      checks.push(Batch.exists({ _id: batchId, institutionId: inst }));
  if (instrumentId) checks.push(Instrument.exists({ _id: instrumentId, institutionId: inst }));
  if (classLevelId) checks.push(ClassLevel.exists({ _id: classLevelId, institutionId: inst }));
  if (!checks.length) return true;
  return (await Promise.all(checks)).every(Boolean);
}

module.exports = { studentRefsValid };
