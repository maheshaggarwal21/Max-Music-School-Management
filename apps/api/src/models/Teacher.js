'use strict';
// TODO: Phase 1 — fields: institutionId (required, indexed), name, email, mobile, gender,
//                 panelAccess [] (PBAC: 'teacher'|'admin'), isOwner, passwordHash (select:false),
//                 recoveryOtp (select:false), tokenVersion, salaryAmount, razorpayPaymentLink,
//                 status (active|inactive)
//                 indexes: { institutionId:1, email:1 } unique, { institutionId:1, status:1 }
module.exports = {};
