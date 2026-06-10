'use strict';

const Student = require('../../models/Student');
const { ok, notFound, badRequest, paginated } = require('../../config/helper');
const { auditLog, actorFromReq } = require('../../config/auditLog');
const S = require('../../config/strings');

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
    if (institutionId) filter.institutionId = institutionId;
    if (status && status !== 'all')         filter.status = status;
    if (joinStatus && joinStatus !== 'all') filter.joinStatus = joinStatus;
    if (instrumentId)  filter.instrumentId = instrumentId;
    if (teacherId)     filter.teacherId = teacherId;
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

exports.get = async (req, res, next) => {
  try {
    const s = await Student.findById(req.params.id).populate(POPULATE).lean();
    if (!s) return notFound(res, S.STUDENT_NOT_FOUND);
    return ok(res, S.OK, { student: serialize(s) });
  } catch (err) {
    next(err);
  }
};

// God-mode edit from the operator panel. Profile + fee fields only — enrollment
// refs (batch/teacher/instrument) are managed inside the institution admin panel.
const JOIN_STATUSES = ['trial', 'active_soon', 'active', 'inactive'];
const FEE_FIELDS = ['paidAmount', 'upcomingAmount', 'paidClasses', 'validityEnd'];

exports.patch = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, S.STUDENT_NOT_FOUND);

    const b = req.body || {};
    const changes = [];
    const apply = (field, value) => {
      const from = field === 'validityEnd'
        ? (student[field] ? new Date(student[field]).toISOString().slice(0, 10) : null)
        : (student[field] ?? null);
      const to = field === 'validityEnd'
        ? (value ? new Date(value).toISOString().slice(0, 10) : null)
        : value;
      if (String(from) === String(to)) return;
      changes.push({ field, from, to });
      student[field] = value === null ? undefined : value;
    };

    if (typeof b.name === 'string' && b.name.trim()) apply('name', b.name.trim());
    if (typeof b.mobile === 'string' && b.mobile.trim()) {
      if (!/^\d{10}$/.test(b.mobile.trim())) return badRequest(res, S.VALIDATION_FAILED);
      apply('mobile', b.mobile.trim());
    }
    if (b.joinStatus !== undefined) {
      if (!JOIN_STATUSES.includes(b.joinStatus)) return badRequest(res, S.VALIDATION_FAILED);
      apply('joinStatus', b.joinStatus);
    }
    if (b.validityEnd !== undefined) {
      if (b.validityEnd !== null && Number.isNaN(Date.parse(b.validityEnd))) {
        return badRequest(res, S.VALIDATION_FAILED);
      }
      apply('validityEnd', b.validityEnd === null ? null : new Date(b.validityEnd));
    }
    for (const f of ['paidAmount', 'upcomingAmount', 'paidClasses']) {
      if (b[f] !== undefined) {
        const n = Number(b[f]);
        if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
        apply(f, Math.round(n));
      }
    }

    if (changes.length) {
      await student.save();
      const onlyFees = changes.every(c => FEE_FIELDS.includes(c.field));
      await auditLog({
        institutionId: student.institutionId,
        ...actorFromReq(req),
        action:      onlyFees ? 'UPDATE_PAID_AMOUNT' : 'UPDATE_STUDENT',
        entityType:  'Student',
        entityId:    student._id,
        entityLabel: `Student: ${student.name}`,
        changes,
        ip: req.ip,
      });
    }

    const fresh = await Student.findById(student._id).populate(POPULATE).lean();
    return ok(res, S.UPDATED, { student: serialize(fresh) });
  } catch (err) {
    next(err);
  }
};
