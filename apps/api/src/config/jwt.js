'use strict';

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// Per-panel secrets. KEEP STRICTLY SEPARATE. A token signed for one panel
// cannot be verified by another — that's the boundary.
// Panels: 'operator', 'admin', 'teacher', 'student', 'god' (impersonation)
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_SECRETS = {
  operator: () => process.env.JWT_SECRET_OPERATOR,
  admin:    () => process.env.JWT_SECRET_ADMIN,
  teacher:  () => process.env.JWT_SECRET_TEACHER,
  student:  () => process.env.JWT_SECRET_STUDENT,
  god:      () => process.env.JWT_SECRET_GOD,
};

const PANEL_EXPIRY = {
  operator: () => process.env.JWT_EXPIRES_OPERATOR || '8h',
  admin:    () => process.env.JWT_EXPIRES_ADMIN    || '12h',
  teacher:  () => process.env.JWT_EXPIRES_TEACHER  || '12h',
  student:  () => process.env.JWT_EXPIRES_STUDENT  || '24h',
  god:      () => process.env.JWT_EXPIRES_GOD      || '15m',
};

const COOKIE_NAME = {
  operator: 'operator_token',
  admin:    'inst_admin_token',
  teacher:  'inst_teacher_token',
  student:  'inst_student_token',
};

function secretFor(panel) {
  const fn = PANEL_SECRETS[panel];
  if (!fn) throw new Error(`Unknown JWT panel: ${panel}`);
  const s = fn();
  if (!s) throw new Error(`Missing JWT secret for panel: ${panel}`);
  return s;
}

function sign(payload, panel, opts = {}) {
  const expiresIn = opts.expiresIn || PANEL_EXPIRY[panel]();
  return jwt.sign({ ...payload, panel }, secretFor(panel), { expiresIn });
}

function verify(token, panel) {
  const decoded = jwt.verify(token, secretFor(panel));
  if (decoded.panel !== panel) {
    throw new Error('Panel mismatch');
  }
  return decoded;
}

// God-token: short-lived, operator-issued, used for impersonation.
// Carries the target panel + institutionId + targetUserId.
function signGodToken({ operatorId, institutionId, panel, targetUserId }) {
  return jwt.sign(
    {
      panel: 'god',
      godMode: true,
      operatorId,
      institutionId: String(institutionId),
      targetPanel: panel,
      targetUserId: targetUserId ? String(targetUserId) : null,
    },
    secretFor('god'),
    { expiresIn: PANEL_EXPIRY.god() }
  );
}

function verifyGodToken(token) {
  const d = jwt.verify(token, secretFor('god'));
  if (!d.godMode || d.panel !== 'god') throw new Error('Not a god token');
  return d;
}

// Socket token: short-lived, minted by an AUTHENTICATED panel endpoint, handed to
// the client to present in the Socket.io handshake. We use a dedicated secret so a
// leaked socket token can never be replayed as a panel cookie, and vice-versa.
// httpOnly panel cookies are path-scoped to /api/inst/:slug and so are NEVER sent
// to the /socket.io handshake — this token is the bridge.
function socketSecret() {
  const s = process.env.JWT_SECRET_SOCKET;
  if (!s) throw new Error('Missing JWT secret for socket');
  return s;
}

function signSocketToken({ userId, institutionId, role }) {
  return jwt.sign(
    { typ: 'socket', sub: String(userId), institutionId: String(institutionId), role },
    socketSecret(),
    { expiresIn: process.env.JWT_EXPIRES_SOCKET || '2m' }
  );
}

function verifySocketToken(token) {
  const d = jwt.verify(token, socketSecret());
  if (d.typ !== 'socket') throw new Error('Not a socket token');
  return d;
}

// Cookie options (httpOnly, secure in prod, sameSite).
// Institution cookies are path-scoped so they cannot leak cross-institution.
// COOKIE_SAME_SITE env var overrides the default — set to 'none' when API and
// panels are on different domains (e.g. Render + Vercel). Defaults to 'strict'
// in production (same-domain VPS) and 'lax' in dev.
function cookieOptions(panel, slug) {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE || (isProd ? 'strict' : 'lax');
  const base = {
    httpOnly: true,
    secure: isProd || sameSite === 'none',
    sameSite,
  };
  if (panel === 'operator') {
    return { ...base, path: '/' };
  }
  if (!slug) throw new Error('Institution cookie requires slug for path scoping');
  return { ...base, path: `/api/inst/${slug}` };
}

module.exports = {
  sign,
  verify,
  signGodToken,
  verifyGodToken,
  signSocketToken,
  verifySocketToken,
  cookieOptions,
  COOKIE_NAME,
  PANEL_EXPIRY,
};
