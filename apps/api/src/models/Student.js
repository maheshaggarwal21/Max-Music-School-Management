'use strict';
// TODO: Phase 1 — fields: institutionId (required, indexed), displayId, name, mobile, email,
//                 gender, instrument, batchId, teacherId, joinStatus (trial|active_soon|active|inactive),
//                 validityStart, validityEnd, validityDays, paidClasses, upcomingClasses,
//                 paidAmount, upcomingAmount, passwordHash (select:false), recoveryOtp (select:false),
//                 tokenVersion, status (active|inactive)
//                 indexes: { institutionId:1, joinStatus:1 }, { institutionId:1, batchId:1 }
module.exports = {};
