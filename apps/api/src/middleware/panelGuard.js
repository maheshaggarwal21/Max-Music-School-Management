'use strict';

const { forbidden } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// panelGuard(panel) — PBAC gate.
// Verifies the actor has `panel` in panelAccess. Used on admin routes mainly:
// a Teacher whose panelAccess is ['teacher'] cannot reach admin routes.
// God-token bypasses.
// ─────────────────────────────────────────────────────────────────────────────

function panelGuard(panel) {
  if (!['admin', 'teacher', 'student'].includes(panel)) {
    throw new Error(`panelGuard: invalid panel ${panel}`);
  }

  return function (req, res, next) {
    if (!req.actor) return forbidden(res, S.AUTH_PANEL_DENIED);
    if (req.actor.godMode) return next();

    const access = req.actor.panelAccess || [];
    if (!access.includes(panel)) {
      return forbidden(res, S.AUTH_PANEL_DENIED);
    }
    next();
  };
}

module.exports = panelGuard;
