'use strict';
// TODO: Phase 2 — instAuth(panel) factory
//                 verify cookie JWT for panel; check instVersion + userVersion (two-level);
//                 check user.panelAccess.includes(panel); sets req.actor
const instAuth = (panel) => (req, res, next) => next();
module.exports = instAuth;
