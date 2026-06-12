'use strict';

const Teacher = require('../../models/Teacher');
const Student = require('../../models/Student');
const { compare } = require('../../config/password');
const { brandingPublic, issuePanelCookie } = require('../../config/instAuthHelpers');
const { COOKIE_NAME, cookieOptions, signSocketToken } = require('../../config/jwt');
const { ok, badRequest, unauthorized, forbidden } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Institution panel auth. resolveInstitution has set req.institution.
//   admin   → Teacher by email,  panelAccess must include 'admin'
//   teacher → Teacher by mobile
//   student → Student by mobile
// Every issued token embeds instVersion + userVersion (P2-R contract #1).
// Responses expose ONLY brandingPublic — never a Max Music identifier.
// Generic "Invalid credentials" for unknown user AND wrong password.
// ─────────────────────────────────────────────────────────────────────────────

const DUMMY_HASH = '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';

async function authTeacher(req, res, { panel, by }) {
  const inst = req.institution;
  const cred = by === 'email'
    ? String((req.body && req.body.email) || '').toLowerCase().trim()
    : String((req.body && req.body.mobile) || '').trim();
  const password = (req.body && req.body.password) || '';
  if (!cred || !password) return badRequest(res, S.VALIDATION_FAILED);

  const query = by === 'email'
    ? { institutionId: inst._id, email: cred }
    : { institutionId: inst._id, mobile: cred };
  const teacher = await Teacher.findOne(query).select('+passwordHash');

  const valid = await compare(password, teacher ? teacher.passwordHash : DUMMY_HASH);
  if (!teacher || !valid) return unauthorized(res, S.AUTH_INVALID);
  if (teacher.status !== 'active') return forbidden(res, S.AUTH_PANEL_DENIED);

  // PBAC: admin panel requires the 'admin' grant; teacher panel requires 'teacher'.
  const needed = panel === 'admin' ? 'admin' : 'teacher';
  if (!(teacher.panelAccess || []).includes(needed)) {
    return forbidden(res, S.AUTH_PANEL_DENIED);
  }

  issuePanelCookie(res, { panel, user: teacher, institution: inst, slug: inst.slug });
  await Teacher.updateOne({ _id: teacher._id }, { $set: { lastLoginAt: new Date() } });

  return ok(res, S.OK, {
    user: {
      _id:           String(teacher._id),
      name:          teacher.name,
      role:          panel === 'admin' ? 'institution_admin' : 'teacher',
      institutionId: String(teacher.institutionId),
      panelAccess:   teacher.panelAccess,
    },
    institution: brandingPublic(inst),
  });
}

exports.adminLogin   = (req, res, next) => authTeacher(req, res, { panel: 'admin',   by: 'email' }).catch(next);
exports.teacherLogin = (req, res, next) => authTeacher(req, res, { panel: 'teacher', by: 'mobile' }).catch(next);

exports.studentLogin = async (req, res, next) => {
  try {
    const inst = req.institution;
    const mobile = String((req.body && req.body.mobile) || '').trim();
    const password = (req.body && req.body.password) || '';
    if (!mobile || !password) return badRequest(res, S.VALIDATION_FAILED);

    const student = await Student
      .findOne({ institutionId: inst._id, mobile })
      .select('+passwordHash');

    const valid = await compare(password, (student && student.passwordHash) ? student.passwordHash : DUMMY_HASH);
    if (!student || !student.passwordHash || !valid) return unauthorized(res, S.AUTH_INVALID);
    // 'hold' students may still log in — only 'inactive' is denied.
    if (student.status === 'inactive') return forbidden(res, S.AUTH_PANEL_DENIED);

    issuePanelCookie(res, { panel: 'student', user: student, institution: inst, slug: inst.slug });

    return ok(res, S.OK, {
      user: {
        _id:           String(student._id),
        name:          student.name,
        displayId:     student.displayId,
        role:          'student',
        institutionId: String(student.institutionId),
      },
      institution: brandingPublic(inst),
    });
  } catch (err) {
    next(err);
  }
};

// Generic me — works for any panel (req.actor + req.institution set by middleware).
exports.me = (req, res) => {
  return ok(res, S.OK, {
    user: {
      _id:           String(req.actor._id),
      name:          req.actor.name,
      role:          req.actor.role,
      institutionId: String(req.actor.institutionId),
      panelAccess:   req.actor.panelAccess,
      displayId:     req.actor.displayId,
    },
    institution: brandingPublic(req.institution),
  });
};

// Public pre-auth branding — every panel's login page renders the institution's
// white-label identity (schoolName / logoUrl / primaryColor / tagline) BEFORE
// sign-in. resolveInstitution has already 404'd unknown slugs and 403'd
// suspended/terminated institutions. Exposes ONLY brandingPublic — never a Max
// Music identifier, and never any authenticated/operational data.
exports.getBranding = (req, res) => {
  return ok(res, S.OK, brandingPublic(req.institution));
};

// Realtime token — minted ONLY for an authenticated actor (req.actor + req.institution
// set by the middleware chain). Short-lived; the client presents it in the Socket.io
// handshake. The institutionId is taken from the SERVER-resolved actor, never the
// client, so a socket can only ever join its own institution's room.
exports.realtimeToken = (req, res) => {
  const token = signSocketToken({
    userId:        req.actor._id,
    institutionId: req.institution._id,
    role:          req.actor.role,
  });
  return ok(res, S.OK, { token });
};

// Factory: clears the panel cookie (path-scoped to the slug).
exports.logout = (panel) => (req, res) => {
  const slug = req.institution ? req.institution.slug : (req.params && req.params.slug);
  res.clearCookie(COOKIE_NAME[panel], cookieOptions(panel, slug));
  return ok(res, S.AUTH_LOGGED_OUT, null);
};
