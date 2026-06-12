'use strict';

const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Operator = require('../models/Operator');
const { verify, verifyGodToken, COOKIE_NAME } = require('../config/jwt');
const { unauthorized, forbidden } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// instAuth(panel) — factory for 'admin' | 'teacher' | 'student' routes.
//
// Order of checks (FAIL FAST):
//   1. God-token (impersonation) — short-circuit path. If req.cookies[COOKIE_NAME[panel]]
//      verifies as a god token AND targetPanel === panel AND institutionId === req.institution._id,
//      we synthesize req.actor with godMode + impersonatedBy. NO scope/panel checks needed
//      downstream — scopeGuard + panelGuard MUST honour req.actor.godMode.
//   2. Otherwise verify the cookie as a panel JWT (panel-specific secret).
//   3. token.instVersion === institution.tokenVersion  (whole-institution logout)
//   4. token.userVersion === user.tokenVersion         (per-user logout)
//   5. user.panelAccess includes the panel             (PBAC)
//   6. user.status === 'active'
//
// Admin login authenticates against Teacher; panel='admin' requires the Teacher's
// panelAccess to include 'admin'.
// ─────────────────────────────────────────────────────────────────────────────

function userModelFor(panel) {
  if (panel === 'student') return Student;
  // admin + teacher both authenticate against Teacher
  return Teacher;
}

function roleFor(panel) {
  if (panel === 'admin')   return 'institution_admin';
  if (panel === 'teacher') return 'teacher';
  if (panel === 'student') return 'student';
  throw new Error(`Unknown panel: ${panel}`);
}

function instAuth(panel) {
  if (!['admin', 'teacher', 'student'].includes(panel)) {
    throw new Error(`instAuth: invalid panel ${panel}`);
  }

  return async function (req, res, next) {
    try {
      if (!req.institution) {
        // resolveInstitution must run first
        return unauthorized(res, S.AUTH_REQUIRED);
      }

      const cookieName = COOKIE_NAME[panel];
      const token = req.cookies && req.cookies[cookieName];
      if (!token) return unauthorized(res, S.AUTH_REQUIRED);

      // ── 1. God-token path (impersonation) ───────────────────────────────────
      // Try god verification FIRST. If panel secret would also verify, we still
      // explicitly check the panel claim, so there's no overlap.
      try {
        const god = verifyGodToken(token);

        // God token must target THIS panel AND THIS institution. Otherwise
        // 401 — a god token forged for institution A must not work on B.
        if (god.targetPanel !== panel) {
          return forbidden(res, S.AUTH_SCOPE_VIOLATION);
        }
        if (String(god.institutionId) !== String(req.institution._id)) {
          return forbidden(res, S.AUTH_SCOPE_VIOLATION);
        }

        // Verify operator still exists.
        const operator = await Operator.findById(god.operatorId).lean();
        if (!operator) return unauthorized(res, S.AUTH_TOKEN_INVALID);

        // Synthesize an actor that scopeGuard + panelGuard recognize.
        req.actor = {
          _id:            god.targetUserId || god.operatorId,
          name:           operator.name,
          email:          operator.email,
          role:           roleFor(panel), // acts as that role
          institutionId:  req.institution._id,
          panelAccess:    [panel],        // synthetic; godMode bypasses panelGuard anyway
          godMode:        true,
          impersonatedBy: operator._id,
        };
        return next();
      } catch {
        // not a god token — fall through to panel verification
      }

      // ── 2. Panel JWT path ──────────────────────────────────────────────────
      let decoded;
      try {
        decoded = verify(token, panel);
      } catch {
        return unauthorized(res, S.AUTH_TOKEN_INVALID);
      }

      // ── 3. Institution-level token version check (whole-institution logout) ──
      if (decoded.instVersion !== req.institution.tokenVersion) {
        return unauthorized(res, S.AUTH_TOKEN_EXPIRED);
      }

      // ── 4. Load user; user-level token version check ───────────────────────
      const UserModel = userModelFor(panel);
      const user = await UserModel.findById(decoded.sub).lean();
      if (!user) return unauthorized(res, S.AUTH_TOKEN_INVALID);
      if (decoded.userVersion !== user.tokenVersion) {
        return unauthorized(res, S.AUTH_TOKEN_EXPIRED);
      }

      // ── 5. User must belong to THIS institution ────────────────────────────
      // Defence-in-depth — scopeGuard will check too, but doing it here means
      // a stolen cookie cannot even reach the controller of a foreign institution.
      if (String(user.institutionId) !== String(req.institution._id)) {
        return forbidden(res, S.AUTH_SCOPE_VIOLATION);
      }

      // ── 6. PBAC: panelAccess includes panel (Teacher/admin) ────────────────
      // Students have no panelAccess field; treat as ['student'] implicitly.
      const access = user.panelAccess || (panel === 'student' ? ['student'] : []);
      if (panel !== 'student' && !access.includes(panel)) {
        return forbidden(res, S.AUTH_PANEL_DENIED);
      }

      // ── 7. Status check ────────────────────────────────────────────────────
      // Only 'inactive' is denied — 'hold' (e.g. partial payment) keeps access.
      if (user.status === 'inactive') {
        return forbidden(res, S.AUTH_PANEL_DENIED);
      }

      req.actor = {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        mobile:        user.mobile,
        displayId:     user.displayId,
        role:          roleFor(panel),
        institutionId: user.institutionId,
        panelAccess:   access,
        tokenVersion:  user.tokenVersion,
        godMode:       false,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = instAuth;
