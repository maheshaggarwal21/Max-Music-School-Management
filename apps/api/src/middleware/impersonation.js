'use strict';

const { signGodToken, COOKIE_NAME, cookieOptions, PANEL_EXPIRY } = require('../config/jwt');

// ─────────────────────────────────────────────────────────────────────────────
// Impersonation lives mostly inside instAuth (god-token recognition path). This
// file holds the OPERATOR-SIDE issuance helper used by the operator's
// /institutions/:id/impersonate endpoint, plus a small helper for resolving
// the impersonatedBy stamp that controllers pass into auditLog().
//
// Flow:
//   1. Operator POSTs /api/operator/institutions/:id/impersonate { panel, targetUserId? }
//   2. Controller calls issueGodCookie(res, { operator, institution, panel, targetUserId, slug })
//      → sets the inst_<panel>_token cookie path-scoped to /api/inst/:slug
//   3. Operator's browser opens https://<PLATFORM_DOMAIN>/<slug>/<panel>?imp=1
//   4. Subsequent /api/inst/:slug/<panel>/* requests carry the god token;
//      instAuth recognizes it, scopeGuard + panelGuard bypass.
// ─────────────────────────────────────────────────────────────────────────────

function issueGodCookie(res, { operator, institution, panel, targetUserId, slug }) {
  if (!operator || !institution || !panel || !slug) {
    throw new Error('issueGodCookie: missing required args');
  }
  if (!['admin', 'teacher', 'student'].includes(panel)) {
    throw new Error(`issueGodCookie: invalid panel ${panel}`);
  }

  const token = signGodToken({
    operatorId:    operator._id,
    institutionId: institution._id,
    panel,
    targetUserId,
  });

  // Cookie is set on the SAME name a normal panel session would use, so the
  // browser sends it on /api/inst/:slug/<panel>/* without any code change.
  res.cookie(COOKIE_NAME[panel], token, cookieOptions(panel, slug));

  return { expiresIn: PANEL_EXPIRY.god() };
}

// Helper for controllers: if the current actor is in god mode, return the
// operator id to stamp on auditLog as impersonatedBy. Else null.
function impersonatedByFromActor(actor) {
  if (actor && actor.godMode && actor.impersonatedBy) return actor.impersonatedBy;
  return null;
}

module.exports = { issueGodCookie, impersonatedByFromActor };
