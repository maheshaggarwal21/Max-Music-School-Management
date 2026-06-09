'use strict';
// TODO: Phase 4 — list (paginated, filter joinStatus/batchId/teacherId), get, create (direct),
//                 patch (paidAmount, upcomingAmount, batchId, teacherId, validity — every change auditLogged)
//                 activityFeed (AuditLog filtered by entityId = studentId)
exports.list = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.get = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.create = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.patch = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.activityFeed = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
