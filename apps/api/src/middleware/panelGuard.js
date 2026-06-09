'use strict';
// TODO: Phase 2 — panelGuard('admin') factory
//                 checks actor.panelAccess ⊇ { admin } for this institution
//                 god-token bypasses
const panelGuard = (panel) => (req, res, next) => next();
module.exports = panelGuard;
