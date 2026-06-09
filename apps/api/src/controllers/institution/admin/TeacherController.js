'use strict';
// TODO: Phase 4 — list, create, patch
//                 HARD RULE: admin CANNOT set panelAccess — reject any request that includes it
exports.list = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.create = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.patch = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
