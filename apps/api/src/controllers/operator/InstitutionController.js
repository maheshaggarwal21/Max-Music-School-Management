'use strict';

const Institution = require('../../models/Institution');
const Teacher     = require('../../models/Teacher');
const Student     = require('../../models/Student');
const Batch       = require('../../models/Batch');
const RentInvoice = require('../../models/RentInvoice');

const { ensureUniqueSlug, nextDisplayId } = require('../../config/specialFunctions');
const { hash, randomTempPassword } = require('../../config/password');
const { auditLog, actorFromReq, diff } = require('../../config/auditLog');
const { issueGodCookie } = require('../../middleware/impersonation');
const { invalidateInstitution } = require('../../middleware/resolveInstitution');
const { PANEL_EXPIRY } = require('../../config/jwt');
const { ok, created, badRequest, notFound, paginated } = require('../../config/helper');
const { sendMail } = require('../../config/mailer');
const { teacherWelcome, grantAdminNotice } = require('../../config/emailTemplates');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator god-mode: full lifecycle of an Institution.
// Honours the three P2-R contracts:
//   - grant/revoke admin → bump owner.tokenVersion AND institution.tokenVersion
//   - suspend / terminate → bump institution.tokenVersion
//   - EVERY state change → invalidateInstitution(slug) to bust the resolve cache
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function brandingPublic(inst) {
  const b = inst.branding || {};
  return {
    slug:         inst.slug,
    schoolName:   b.schoolName || inst.name,
    logoUrl:      b.logoUrl || null,
    primaryColor: b.primaryColor || '#5B8DEF',
    tagline:      b.tagline || null,
  };
}

function rentStatusFor(inst, latestInvoice) {
  if (inst.mode !== 'autonomous') return 'na';
  if (!latestInvoice) return 'pending';
  if (latestInvoice.status === 'paid') return 'paid';
  if (latestInvoice.status === 'overdue') return 'overdue';
  return 'pending';
}

// Build InstitutionListItem[] for a page of institutions, with batched counts.
async function toListItems(institutions) {
  const ids = institutions.map(i => i._id);
  if (!ids.length) return [];

  const ownerIds = institutions.map(i => i.ownerTeacherId).filter(Boolean);

  const [studentAgg, teacherAgg, owners, invoices] = await Promise.all([
    Student.aggregate([{ $match: { institutionId: { $in: ids } } }, { $group: { _id: '$institutionId', c: { $sum: 1 } } }]),
    Teacher.aggregate([{ $match: { institutionId: { $in: ids } } }, { $group: { _id: '$institutionId', c: { $sum: 1 } } }]),
    Teacher.find({ _id: { $in: ownerIds } }).select('name mobile').lean(),
    RentInvoice.aggregate([
      { $match: { institutionId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$institutionId', status: { $first: '$status' } } },
    ]),
  ]);

  const sMap = new Map(studentAgg.map(x => [String(x._id), x.c]));
  const tMap = new Map(teacherAgg.map(x => [String(x._id), x.c]));
  const oMap = new Map(owners.map(o => [String(o._id), o]));
  const iMap = new Map(invoices.map(x => [String(x._id), x]));

  return institutions.map(inst => {
    const owner = inst.ownerTeacherId ? oMap.get(String(inst.ownerTeacherId)) : null;
    return {
      _id:    String(inst._id),
      name:   inst.name,
      slug:   inst.slug,
      mode:   inst.mode,
      status: inst.status,
      ownerTeacher: owner ? { _id: String(owner._id), name: owner.name, mobile: owner.mobile } : null,
      studentCount: sMap.get(String(inst._id)) || 0,
      teacherCount: tMap.get(String(inst._id)) || 0,
      rentStatus:   rentStatusFor(inst, iMap.get(String(inst._id))),
      branding:     brandingPublic(inst),
      createdAt:    inst.createdAt,
    };
  });
}

async function oneListItem(instDoc) {
  const [item] = await toListItems([instDoc.toObject ? instDoc.toObject() : instDoc]);
  return item;
}

// ── CREATE ───────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  let institution = null;
  try {
    const { name, mode, contactEmail, owner, rent, branding } = req.body || {};

    if (!name || !contactEmail || !owner) return badRequest(res, S.VALIDATION_FAILED);
    if (!['managed', 'autonomous'].includes(mode)) return badRequest(res, S.VALIDATION_FAILED);
    if (mode === 'autonomous' && (!rent || typeof rent.amount !== 'number' || !rent.firstDueDate)) {
      return badRequest(res, S.VALIDATION_FAILED);
    }
    const hasInlineOwner = owner.name && owner.mobile && owner.email;
    if (!owner.existingTeacherId && !hasInlineOwner) return badRequest(res, S.VALIDATION_FAILED);

    const slug = await ensureUniqueSlug(name);

    institution = await Institution.create({
      name: String(name).trim(),
      slug,
      mode,
      status: 'pending',
      createdByOperatorId: req.operator._id,
      contactEmail: String(contactEmail).toLowerCase().trim(),
      branding: {
        schoolName:   (branding && branding.schoolName) || String(name).trim(),
        primaryColor: (branding && branding.primaryColor) || '#5B8DEF',
        tagline:      (branding && branding.tagline) || undefined,
      },
      rent: mode === 'autonomous'
        ? { amount: rent.amount, billingCycle: 'monthly', nextDueDate: new Date(rent.firstDueDate) }
        : undefined,
    });

    const panelAccess    = mode === 'autonomous' ? ['teacher', 'admin'] : ['teacher'];
    const employmentType = mode === 'autonomous' ? 'rent' : 'salary';

    let ownerTeacher;
    let ownerTempPassword = null;

    if (owner.existingTeacherId) {
      ownerTeacher = await Teacher.findById(owner.existingTeacherId);
      if (!ownerTeacher) {
        await Institution.deleteOne({ _id: institution._id });
        return notFound(res, S.TEACHER_NOT_FOUND);
      }
      // Isolation guard: a Teacher is scoped to ONE institution. Refuse to move
      // a teacher who already belongs to a different school (that would orphan
      // their students/batches there). Onboard such people via inline owner.
      if (ownerTeacher.institutionId &&
          String(ownerTeacher.institutionId) !== String(institution._id)) {
        await Institution.deleteOne({ _id: institution._id });
        return badRequest(res, S.TEACHER_BELONGS_ELSEWHERE);
      }
      ownerTeacher.institutionId  = institution._id;
      ownerTeacher.isOwner        = true;
      ownerTeacher.panelAccess    = panelAccess;
      ownerTeacher.employmentType = employmentType;
      await ownerTeacher.save();
    } else {
      ownerTempPassword = randomTempPassword();
      const passwordHash = await hash(ownerTempPassword);
      const displayId = await nextDisplayId(institution._id, 'teacher');
      ownerTeacher = await Teacher.create({
        institutionId: institution._id,
        displayId,
        name:   String(owner.name).trim(),
        mobile: String(owner.mobile).trim(),
        email:  String(owner.email).toLowerCase().trim(),
        isOwner: true,
        panelAccess,
        employmentType,
        passwordHash,
      });
    }

    institution.ownerTeacherId = ownerTeacher._id;
    await institution.save();

    await auditLog({
      institutionId: institution._id,
      ...actorFromReq(req),
      action:      'CREATE_INSTITUTION',
      entityType:  'Institution',
      entityId:    institution._id,
      entityLabel: `Institution: ${institution.name}`,
      after:       institution.toObject(),
      ip:          req.ip,
    });

    const item = await oneListItem(institution);

    // Email the owner their temp password (fail-soft — never block the response).
    if (ownerTempPassword && ownerTeacher.email) {
      const slug = institution.slug;
      const panelUrl = `${process.env.PLATFORM_DOMAIN_URL || ''}/${slug}/teacher`;
      const tpl = teacherWelcome({
        schoolName:   institution.branding.schoolName,
        primaryColor: institution.branding.primaryColor,
        teacherName:  ownerTeacher.name,
        panelUrl,
        tempPassword: ownerTempPassword,
      });
      sendMail({ to: ownerTeacher.email, ...tpl, institution }).catch(() => {});
    }

    return created(res, S.INST_CREATED, { institution: item, ownerTempPassword });
  } catch (err) {
    // Roll back the orphan institution if owner provisioning failed mid-way.
    if (institution && institution._id) {
      await Institution.deleteOne({ _id: institution._id }).catch(() => {});
    }
    next(err);
  }
};

// ── LIST ─────────────────────────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, mode, status } = req.query;

    const filter = {};
    if (mode && mode !== 'all')     filter.mode = mode;
    if (status && status !== 'all') filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { slug: rx }];
    }

    const result = await Institution.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
    });

    const items = await toListItems(result.docs);
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};

// ── GET (detail) ───────────────────────────────────────────────────────────────
exports.get = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id).lean();
    if (!inst) return notFound(res, S.INST_NOT_FOUND);

    const [base] = await toListItems([inst]);

    const [batches, activeStudents, trialStudents] = await Promise.all([
      Batch.countDocuments({ institutionId: inst._id }),
      Student.countDocuments({ institutionId: inst._id, joinStatus: 'active' }),
      Student.countDocuments({ institutionId: inst._id, joinStatus: 'trial' }),
    ]);

    const detail = {
      ...base,
      contactEmail: inst.contactEmail,
      rent: inst.rent
        ? { amount: inst.rent.amount, billingCycle: inst.rent.billingCycle, nextDueDate: inst.rent.nextDueDate || null }
        : null,
      counts: { batches, activeStudents, trialStudents },
    };
    return ok(res, S.OK, { institution: detail });
  } catch (err) {
    next(err);
  }
};

// ── UPDATE (name / branding / contactEmail / rent — NOT slug, NOT mode) ────────
exports.update = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);

    const { name, branding, contactEmail, rent } = req.body || {};
    const before = inst.toObject();

    if (typeof name === 'string' && name.trim()) inst.name = name.trim();
    if (typeof contactEmail === 'string' && contactEmail.trim()) {
      inst.contactEmail = contactEmail.toLowerCase().trim();
    }
    if (branding && typeof branding === 'object') {
      if (branding.schoolName)   inst.branding.schoolName   = branding.schoolName;
      if (branding.logoUrl !== undefined) inst.branding.logoUrl = branding.logoUrl;
      if (branding.primaryColor) inst.branding.primaryColor = branding.primaryColor;
      if (branding.tagline !== undefined) inst.branding.tagline = branding.tagline;
    }
    if (rent && typeof rent === 'object' && inst.mode === 'autonomous') {
      inst.rent = inst.rent || {};
      if (typeof rent.amount === 'number') inst.rent.amount = rent.amount;
      if (rent.nextDueDate) inst.rent.nextDueDate = new Date(rent.nextDueDate);
    }

    await inst.save();
    invalidateInstitution(inst.slug);

    const changes = diff(before, inst.toObject(), ['name', 'contactEmail', 'branding', 'rent']);
    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'UPDATE_INSTITUTION',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes,
      ip:          req.ip,
    });

    return ok(res, S.INST_UPDATED, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── GRANT ADMIN (managed → autonomous; scenario 3) ─────────────────────────────
exports.grantAdmin = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);
    if (!inst.ownerTeacherId) return badRequest(res, S.INST_NO_OWNER);

    const owner = await Teacher.findById(inst.ownerTeacherId);
    if (!owner) return badRequest(res, S.INST_NO_OWNER);

    // Idempotent: if already granted, do NOT bump tokenVersion (that would mass-
    // logout the whole institution on a redundant click). Return current state.
    if (inst.mode === 'autonomous' && owner.panelAccess.includes('admin')) {
      return ok(res, S.INST_GRANT_ADMIN, { institution: await oneListItem(inst) });
    }

    const prevMode = inst.mode;
    if (!owner.panelAccess.includes('admin')) owner.panelAccess.push('admin');
    owner.employmentType = 'rent';
    owner.tokenVersion  += 1;                 // P2-R: per-user logout
    await owner.save();

    inst.mode          = 'autonomous';
    inst.tokenVersion += 1;                   // P2-R: mode toggle → whole-institution logout
    await inst.save();

    invalidateInstitution(inst.slug);         // P2-R: bust resolve cache

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'TOGGLE_MODE',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'mode', from: prevMode, to: 'autonomous' }],
      ip:          req.ip,
    });

    // Notify the owner that admin access has been granted (fail-soft).
    if (owner.email) {
      const adminPanelUrl = `${process.env.PLATFORM_DOMAIN_URL || ''}/${inst.slug}/admin`;
      const tpl = grantAdminNotice({
        schoolName:   inst.branding.schoolName,
        primaryColor: inst.branding.primaryColor,
        teacherName:  owner.name,
        adminPanelUrl,
      });
      sendMail({ to: owner.email, ...tpl, institution: inst }).catch(() => {});
    }

    return ok(res, S.INST_GRANT_ADMIN, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── REVOKE ADMIN (autonomous → managed) ────────────────────────────────────────
exports.revokeAdmin = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);
    if (!inst.ownerTeacherId) return badRequest(res, S.INST_NO_OWNER);

    const owner = await Teacher.findById(inst.ownerTeacherId);
    if (!owner) return badRequest(res, S.INST_NO_OWNER);

    // Idempotent: if already managed and admin already removed, no-op (no mass logout).
    if (inst.mode === 'managed' && !owner.panelAccess.includes('admin')) {
      return ok(res, S.INST_REVOKE_ADMIN, { institution: await oneListItem(inst) });
    }

    const prevMode = inst.mode;
    owner.panelAccess    = owner.panelAccess.filter(p => p !== 'admin');
    owner.employmentType = 'salary';
    owner.tokenVersion  += 1;
    await owner.save();

    inst.mode          = 'managed';
    inst.tokenVersion += 1;
    await inst.save();

    invalidateInstitution(inst.slug);

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'TOGGLE_MODE',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'mode', from: prevMode, to: 'managed' }],
      ip:          req.ip,
    });

    return ok(res, S.INST_REVOKE_ADMIN, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── SUSPEND ────────────────────────────────────────────────────────────────────
exports.suspend = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);

    inst.status       = 'suspended';
    inst.suspendedAt  = new Date();
    inst.tokenVersion += 1;                   // P2-R: kill all institution sessions
    await inst.save();

    invalidateInstitution(inst.slug);

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'SUSPEND_INSTITUTION',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'status', from: 'active', to: 'suspended' }],
      ip:          req.ip,
    });

    return ok(res, S.INST_SUSPENDED, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── REACTIVATE ─────────────────────────────────────────────────────────────────
exports.reactivate = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);

    inst.status = 'active';
    if (!inst.activatedAt) inst.activatedAt = new Date();
    inst.suspendedAt = undefined;
    await inst.save();

    invalidateInstitution(inst.slug);

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'REACTIVATE_INSTITUTION',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'status', from: 'suspended', to: 'active' }],
      ip:          req.ip,
    });

    return ok(res, S.INST_REACTIVATED, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── TERMINATE (permanent; data retained) ───────────────────────────────────────
exports.terminate = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return notFound(res, S.INST_NOT_FOUND);

    const prev = inst.status;
    inst.status        = 'terminated';
    inst.terminatedAt  = new Date();
    inst.tokenVersion += 1;                   // kill all sessions for good
    await inst.save();

    invalidateInstitution(inst.slug);

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'TERMINATE_INSTITUTION',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'status', from: prev, to: 'terminated' }],
      ip:          req.ip,
    });

    return ok(res, S.INST_TERMINATED, { institution: await oneListItem(inst) });
  } catch (err) {
    next(err);
  }
};

// ── IMPERSONATE (issue short-lived god cookie) ─────────────────────────────────
function parseDurationSec(str) {
  const m = /^(\d+)([smh])$/.exec(String(str || '15m').trim());
  if (!m) return 900;
  const n = parseInt(m[1], 10);
  return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n;
}

exports.impersonate = async (req, res, next) => {
  try {
    const inst = await Institution.findById(req.params.id).lean();
    if (!inst) return notFound(res, S.INST_NOT_FOUND);
    if (inst.status === 'terminated' || inst.status === 'suspended') {
      return badRequest(res, S.INST_NOT_AVAILABLE);
    }

    const { panel, targetUserId } = req.body || {};
    if (!['admin', 'teacher', 'student'].includes(panel)) return badRequest(res, S.VALIDATION_FAILED);

    // For admin, default the target to the owner teacher. teacher/student MUST
    // name a target — without one the synthesized actor carries the operator id
    // in that role and every req.actor._id query returns nothing (dead session).
    const resolvedTarget = targetUserId || (panel === 'admin' ? inst.ownerTeacherId : undefined);
    if (!resolvedTarget) return badRequest(res, S.VALIDATION_FAILED);

    issueGodCookie(res, {
      operator:    req.operator,
      institution: inst,
      panel,
      targetUserId: resolvedTarget,
      slug:        inst.slug,
    });

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'IMPERSONATE_START',
      entityType:  'Institution',
      entityId:    inst._id,
      entityLabel: `Institution: ${inst.name}`,
      changes:     [{ field: 'panel', from: null, to: panel }],
      ip:          req.ip,
    });

    const base = process.env.PLATFORM_DOMAIN_URL || '';
    const url  = `${base}/${inst.slug}/${panel}?imp=1`;
    return ok(res, S.INST_IMPERSONATE, { url, expiresInSec: parseDurationSec(PANEL_EXPIRY.god()) });
  } catch (err) {
    next(err);
  }
};
