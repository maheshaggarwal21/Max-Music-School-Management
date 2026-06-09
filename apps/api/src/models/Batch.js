'use strict';
// TODO: Phase 1 — fields: institutionId (required), name (auto-encoded), instrumentId,
//                 dayPatternId, timeSlotId, teacherId (null = Setting Phase),
//                 studentCount (denormalized), status (active|inactive)
//                 indexes: { institutionId:1, status:1 }, { institutionId:1, teacherId:1 }
module.exports = {};
