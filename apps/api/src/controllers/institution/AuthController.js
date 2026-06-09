'use strict';
// TODO: Phase 4 — login for each panel (admin/teacher/student)
//                 me: includes Institution.branding in response (white-label source of truth)
//                 logout: clear panel cookie
exports.adminLogin = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.teacherLogin = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.studentLogin = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.me = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.logout = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
