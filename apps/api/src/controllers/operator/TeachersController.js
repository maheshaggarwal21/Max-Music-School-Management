'use strict';

const Teacher = require('../../models/Teacher');
const Batch   = require('../../models/Batch');
const { ok, notFound, badRequest, paginated } = require('../../config/helper');
const { auditLog, actorFromReq } = require('../../config/auditLog');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-INSTITUTION teacher view (god-mode). Tagged with institution.
// amount = salaryAmount (managed/salaried) OR institution rent (autonomous owner).
// passwordHash / recoveryOtp are select:false → never reach here.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const POPULATE = [{ path: 'institutionId', select: 'name slug mode rent' }];

async function activeBatchMap(teacherIds) {
  if (!teacherIds.length) return new Map();
  const agg = await Batch.aggregate([
    { $match: { teacherId: { $in: teacherIds }, status: 'active' } },
    { $group: { _id: '$teacherId', c: { $sum: 1 } } },
  ]);
  return new Map(agg.map(x => [String(x._id), x.c]));
}

function amountFor(t) {
  const inst = t.institutionId;
  if (t.isOwner && inst && inst.mode === 'autonomous') {
    return (inst.rent && typeof inst.rent.amount === 'number') ? inst.rent.amount : null;
  }
  return typeof t.salaryAmount === 'number' ? t.salaryAmount : null;
}

function serialize(t, batchCount) {
  const inst = t.institutionId;
  return {
    _id:       String(t._id),
    displayId: t.displayId,
    name:      t.name,
    mobile:    t.mobile,
    email:     t.email,
    institution: inst ? { _id: String(inst._id), name: inst.name, slug: inst.slug } : null,
    role:           t.isOwner ? 'owner' : 'staff',
    employmentType: t.employmentType || 'salary',
    amount:         amountFor(t),
    activeBatches:  batchCount,
    status:         t.status,
    createdAt:      t.createdAt,
  };
}

exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, institutionId, employmentType, status } = req.query;

    const filter = {};
    if (institutionId)   filter.institutionId = institutionId;
    if (employmentType && employmentType !== 'all') filter.employmentType = employmentType;
    if (status && status !== 'all')                 filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { mobile: rx }, { email: rx }, { displayId: rx }];
    }

    const result = await Teacher.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: POPULATE,
    });

    const bMap = await activeBatchMap(result.docs.map(d => d._id));
    const items = result.docs.map(t => serialize(t, bMap.get(String(t._id)) || 0));
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const t = await Teacher.findById(req.params.id).populate(POPULATE).lean();
    if (!t) return notFound(res, S.TEACHER_NOT_FOUND);
    const bMap = await activeBatchMap([t._id]);
    return ok(res, S.OK, { teacher: serialize(t, bMap.get(String(t._id)) || 0) });
  } catch (err) {
    next(err);
  }
};

// God-mode edit from the operator panel. Profile + salary + status only —
// panelAccess and institution are managed via the institution lifecycle actions.
exports.patch = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return notFound(res, S.TEACHER_NOT_FOUND);

    const b = req.body || {};
    const changes = [];
    const apply = (field, value) => {
      const from = teacher[field] ?? null;
      if (String(from) === String(value)) return;
      changes.push({ field, from, to: value });
      teacher[field] = value;
    };

    if (typeof b.name === 'string' && b.name.trim()) apply('name', b.name.trim());
    if (typeof b.mobile === 'string' && b.mobile.trim()) {
      if (!/^\d{10}$/.test(b.mobile.trim())) return badRequest(res, S.VALIDATION_FAILED);
      apply('mobile', b.mobile.trim());
    }
    if (b.salaryAmount !== undefined) {
      const n = Number(b.salaryAmount);
      if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
      apply('salaryAmount', Math.round(n));
    }
    if (b.status !== undefined) {
      if (!['active', 'inactive'].includes(b.status)) return badRequest(res, S.VALIDATION_FAILED);
      const wasActive = teacher.status === 'active';
      apply('status', b.status);
      // Deactivation logs the teacher out everywhere (two-level invalidation).
      if (wasActive && b.status === 'inactive') teacher.tokenVersion += 1;
    }

    if (changes.length) {
      await teacher.save();
      await auditLog({
        institutionId: teacher.institutionId,
        ...actorFromReq(req),
        action:      'UPDATE_TEACHER',
        entityType:  'Teacher',
        entityId:    teacher._id,
        entityLabel: `Teacher: ${teacher.name}`,
        changes,
        ip: req.ip,
      });
    }

    const fresh = await Teacher.findById(teacher._id).populate(POPULATE).lean();
    const bMap = await activeBatchMap([fresh._id]);
    return ok(res, S.UPDATED, { teacher: serialize(fresh, bMap.get(String(fresh._id)) || 0) });
  } catch (err) {
    next(err);
  }
};
