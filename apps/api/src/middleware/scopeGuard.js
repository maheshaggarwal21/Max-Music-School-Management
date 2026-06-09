'use strict';

const { forbidden } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// scopeGuard — THE GOLDEN RULE GATE.
// req.actor.institutionId must equal req.institution._id, else 403.
// Superadmin god-token bypasses (instAuth already enforced institution match
// for god tokens, so godMode === true is safe here).
// ─────────────────────────────────────────────────────────────────────────────

module.exports = function scopeGuard(req, res, next) {
  if (!req.institution || !req.actor) {
    return forbidden(res, S.AUTH_SCOPE_VIOLATION);
  }

  if (req.actor.godMode) {
    // instAuth already verified god.institutionId === req.institution._id
    return next();
  }

  if (String(req.actor.institutionId) !== String(req.institution._id)) {
    return forbidden(res, S.AUTH_SCOPE_VIOLATION);
  }

  next();
};
