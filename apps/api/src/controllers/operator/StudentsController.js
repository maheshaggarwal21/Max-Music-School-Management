'use strict';

const mongoose    = require('mongoose');
const Student     = require('../../models/Student');
const Institution = require('../../models/Institution');
const Batch       = require('../../models/Batch');
const { nextDisplayId } = require('../../config/specialFunctions');
const { studentRefsValid } = require('../../config/refGuard');
const { hash, randomTempPassword } = require('../../config/password');
const { ok, created, badRequest, notFound, paginated } = require('../../config/helper');
const { auditLog, diff, actorFromReq } = require('../../config/auditLog');
const S = require('../../config/strings');

const JOIN_STATUSES = ['trial', 'active_soon', 'active', 'inactive'];

// Fields the operator may set on a new student (same set the admin create accepts).
const CREATE_FIELDS = [
  'teacherId', 'batchId', 'instrumentId', 'gender', 'classType', 'mode', 'joinStatus',
  'sessionType', 'category', 'validityStart', 'validityEnd', 'validityDays',
  'paidClasses', 'upcomingClasses', 'paidAmount', 'upcomingAmount', 'status',
];

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-INSTITUTION student view (god-mode). The ONLY place students from many
// institutions appear together. Every row is TAGGED with its institution + teacher.
// institutionId here is an optional FILTER from the operator, never an isolation
// boundary — this route is intentionally outside /api/inst/:slug/*.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const POPULATE = [
  { path: 'institutionId', select: 'name slug' },
  { path: 'teacherId',     select: 'name' },
  { path: 'batchId',       select: 'name' },
  { path: 'instrumentId',  select: 'name' },
];

function serialize(s) {
  return {
    _id:       String(s._id),
    displayId: s.displayId,
    name:      s.name,
    mobile:    s.mobile,
    email:     s.email || null,
    institution: s.institutionId
      ? { _id: String(s.institutionId._id), name: s.institutionId.name, slug: s.institutionId.slug }
      : null,
    teacher: s.teacherId ? { _id: String(s.teacherId._id), name: s.teacherId.name } : null,
    batch:   s.batchId ? { _id: String(s.batchId._id), name: s.batchId.name } : null,
    instrument: s.instrumentId ? s.instrumentId.name : null,
    joinStatus:     s.joinStatus,
    paidAmount:     s.paidAmount || 0,
    upcomingAmount: s.upcomingAmount || 0,
    validityEnd:    s.validityEnd || null,
    createdAt:      s.createdAt,
  };
}

exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, institutionId, status, joinStatus, instrumentId, teacherId } = req.query;

    const filter = {};
    if (institutionId && institutionId !== 'all') filter.institutionId = institutionId;
    if (status && status !== 'all')               filter.status = status;
    if (joinStatus && joinStatus !== 'all')       filter.joinStatus = joinStatus;
    if (instrumentId && instrumentId !== 'all')   filter.instrumentId = instrumentId;
    if (teacherId && teacherId !== 'all')         filter.teacherId = teacherId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { displayId: rx }];
    }

    const result = await Student.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: POPULATE,
    });

    return ok(res, S.OK, paginated(result.docs.map(serialize), result));
  } catch (err) {
    next(err);
  }
};

// ── GOD-MODE CREATE ──────────────────────────────────────────────────────────
// Operator directly enrols a student into ANY institution (institutionId comes
// from the body — this is the ONE create that is cross-institution by design).
// Mirrors the admin create, but the target tenant is explicit + validated. All
// teacher/batch/instrument refs are checked against THAT institution (golden rule).
exports.create = async (req, res, next) => {
  try {
    const { institutionId, name, mobile } = req.body || {};
    if (!institutionId || !mongoose.isValidObjectId(institutionId)) return badRequest(res, S.VALIDATION_FAILED);
    if (!name || !mobile) return badRequest(res, S.VALIDATION_FAILED);

    const inst = await Institution.findById(institutionId).select('_id status').lean();
    if (!inst) return notFound(res, S.INST_NOT_FOUND);
    if (inst.status === 'terminated') return badRequest(res, S.INST_NOT_AVAILABLE);

    // GOLDEN RULE: foreign teacher/batch/instrument refs rejected before persist.
    if (!(await studentRefsValid(inst._id, req.body))) return badRequest(res, S.STUDENT_BAD_REFS);

    if (req.body.joinStatus !== undefined && !JOIN_STATUSES.includes(req.body.joinStatus)) {
      return badRequest(res, S.VALIDATION_FAILED);
    }

    const displayId    = await nextDisplayId(inst._id, 'student');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const doc = {
      institutionId: inst._id, displayId,
      name: String(name).trim(), mobile: String(mobile).trim(), passwordHash,
    };
    if (req.body.email) doc.email = String(req.body.email).toLowerCase().trim();
    for (const f of CREATE_FIELDS) if (req.body[f] !== undefined) doc[f] = req.body[f];

    const student = await Student.create(doc);
    if (student.batchId) {
      await Batch.updateOne({ _id: student.batchId, institutionId: inst._id }, { $inc: { studentCount: 1 } });
    }

    await auditLog({
      institutionId: inst._id,
      ...actorFromReq(req),
      action:      'CREATE_STUDENT',
      entityType:  'Student',
      entityId:    student._id,
      entityLabel: `Student: ${student.name}`,
      after:       { displayId: student.displayId, paidAmount: student.paidAmount },
      ip:          req.ip,
    });

    // Re-fetch populated so the operator table row carries institution/teacher tags.
    const full = await Student.findById(student._id).populate(POPULATE).lean();
    return created(res, S.STUDENT_CREATED, { student: serialize(full), tempPassword });
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id).populate(POPULATE).lean();
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    return ok(res, S.OK, { student: serialize(s) });
  } catch (err) {
    next(err);
  }
};

// ── GOD-MODE EDIT ──────────────────────────────────────────────────────────────
// Operator can patch a student's profile + fee fields from any institution. Each
// change is audited per-diff, scoped to the student's OWN institutionId (so it
// surfaces in that institution's activity feed). Enrollment-structural fields
// (teacher/batch/instrument) are managed inside the institution admin panel, not here.
const FEE_FIELDS = ['paidAmount', 'upcomingAmount', 'paidClasses', 'validityEnd'];

exports.update = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id);
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);

    const b = req.body || {};
    const before = s.toObject();

    if (typeof b.name === 'string' && b.name.trim())   s.name = b.name.trim();
    if (typeof b.mobile === 'string' && b.mobile.trim()) {
      if (!/^\d{10}$/.test(b.mobile.trim())) return badRequest(res, S.VALIDATION_FAILED);
      s.mobile = b.mobile.trim();
    }
    if (b.joinStatus !== undefined) {
      if (!JOIN_STATUSES.includes(b.joinStatus)) return badRequest(res, S.VALIDATION_FAILED);
      s.joinStatus = b.joinStatus;
    }
    if (b.validityEnd !== undefined) {
      if (b.validityEnd != null && b.validityEnd !== '' && Number.isNaN(Date.parse(b.validityEnd))) {
        return badRequest(res, S.VALIDATION_FAILED);
      }
      s.validityEnd = b.validityEnd == null || b.validityEnd === '' ? undefined : new Date(b.validityEnd);
    }
    for (const f of ['paidAmount', 'upcomingAmount', 'paidClasses']) {
      if (b[f] !== undefined) {
        const n = Number(b[f]);
        if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
        s[f] = Math.round(n);
      }
    }

    await s.save();

    const changes = diff(before, s.toObject(),
      ['name', 'mobile', 'joinStatus', 'validityEnd', 'paidAmount', 'upcomingAmount', 'paidClasses']);
    if (changes.length) {
      const onlyFees = changes.every(c => FEE_FIELDS.includes(c.field));
      await auditLog({
        institutionId: s.institutionId,
        ...actorFromReq(req),
        action:      onlyFees ? 'UPDATE_PAID_AMOUNT' : 'UPDATE_STUDENT',
        entityType:  'Student',
        entityId:    s._id,
        entityLabel: `Student: ${s.name}`,
        changes,
        ip:          req.ip,
      });
    }

    const fresh = await Student.findById(s._id).populate(POPULATE).lean();
    return ok(res, S.STUDENT_UPDATED, { student: serialize(fresh) });
  } catch (err) {
    next(err);
  }
};
