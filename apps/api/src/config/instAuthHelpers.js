'use strict';

const { sign, COOKIE_NAME, cookieOptions } = require('./jwt');

// ─────────────────────────────────────────────────────────────────────────────
// Shared institution-panel auth helpers.
//
// brandingPublic — the ONLY institution data ever sent to a panel. Contains NO
// Max Music identifiers (white-label rule). Every institution-panel response that
// includes "institution" uses this shape.
//
// issuePanelCookie — the single place that embeds the P2-R two-level invalidation
// contract: the JWT carries BOTH instVersion (institution.tokenVersion) and
// userVersion (user.tokenVersion). instAuth rejects the token if either drifts.
// Cookie is path-scoped to /api/inst/:slug so it never leaks cross-institution.
// ─────────────────────────────────────────────────────────────────────────────

function brandingPublic(institution) {
  const b = (institution && institution.branding) || {};
  return {
    slug:         institution.slug,
    schoolName:   b.schoolName || institution.name,
    logoUrl:      b.logoUrl || null,
    primaryColor: b.primaryColor || '#5B8DEF',
    tagline:      b.tagline || null,
  };
}

function issuePanelCookie(res, { panel, user, institution, slug }) {
  const token = sign(
    {
      sub:         String(user._id),
      instVersion: institution.tokenVersion,   // whole-institution invalidation
      userVersion: user.tokenVersion,          // per-user invalidation
    },
    panel
  );
  res.cookie(COOKIE_NAME[panel], token, cookieOptions(panel, slug));
  return token;
}

module.exports = { brandingPublic, issuePanelCookie };
