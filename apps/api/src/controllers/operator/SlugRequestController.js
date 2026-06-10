'use strict';

const mongoose          = require('mongoose');
const Institution       = require('../../models/Institution');
const SlugChangeRequest = require('../../models/SlugChangeRequest');
const { invalidateInstitution } = require('../../middleware/resolveInstitution');
const { auditLog, actorFromReq } = require('../../config/auditLog');
const { ok, badRequest, notFound, paginated } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator god-mode: review slug change requests filed by institution admins.
// Approval is the ONLY path that ever changes a slug. It deliberately bypasses
// the schema's immutability guard via the native driver, bumps the institution
// tokenVersion (cookies are path-scoped to the old slug → everyone must log in
// again), and busts the resolver cache for BOTH slugs.
// ─────────────────────────────────────────────────────────────────────────────

function rowOf(r) {
  return {
    _id: String(r._id),
    institution: r.institutionId && r.institutionId._id
      ? { _id: String(r.institutionId._id), name: r.institutionId.name, slug: r.institutionId.slug }
      : { _id: String(r.institutionId) },
    currentSlug:   r.currentSlug,
    requestedSlug: r.requestedSlug,
    reason:        r.reason || null,
    status:        r.status,
    requestedBy:   r.requestedBy ? { actorName: r.requestedBy.actorName || null } : null,
    handledAt:     r.handledAt || null,
    rejectionReason: r.rejectionReason || null,
    createdAt:     r.createdAt,
  };
}

exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const result = await SlugChangeRequest.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
      populate: { path: 'institutionId', select: 'name slug' },
    });
    return ok(res, S.OK, paginated(result.docs.map(rowOf), result));
  } catch (err) {
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const request = await SlugChangeRequest.findById(req.params.id);
    if (!request) return notFound(res, S.SLUG_REQUEST_NOT_FOUND);
    if (request.status !== 'pending') return badRequest(res, S.SLUG_REQUEST_HANDLED);

    const institution = await Institution.findById(request.institutionId);
    if (!institution) return notFound(res, S.INST_NOT_FOUND);

    const taken = await Institution.exists({ slug: request.requestedSlug });
    if (taken) return badRequest(res, S.SLUG_REQUEST_TAKEN);

    const oldSlug = institution.slug;

    // Native update: the one sanctioned bypass of the slug-immutability guard.
    // tokenVersion bump logs out every session (their cookies are path-scoped
    // to the old slug and would silently stop matching anyway).
    await Institution.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(String(institution._id)) },
      { $set: { slug: request.requestedSlug }, $inc: { tokenVersion: 1 } }
    );

    request.status = 'approved';
    request.handledByOperatorId = req.operator._id;
    request.handledAt = new Date();
    await request.save();

    invalidateInstitution(oldSlug);
    invalidateInstitution(request.requestedSlug);

    await auditLog({
      institutionId: institution._id, ...actorFromReq(req),
      action: 'APPROVE_SLUG_CHANGE', entityType: 'Institution', entityId: institution._id,
      entityLabel: `Institution: ${institution.name}`,
      changes: [{ field: 'slug', from: oldSlug, to: request.requestedSlug }],
      ip: req.ip,
    });

    return ok(res, S.SLUG_REQUEST_APPROVED, {
      institution: { _id: String(institution._id), slug: request.requestedSlug },
    });
  } catch (err) {
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const request = await SlugChangeRequest.findById(req.params.id);
    if (!request) return notFound(res, S.SLUG_REQUEST_NOT_FOUND);
    if (request.status !== 'pending') return badRequest(res, S.SLUG_REQUEST_HANDLED);

    request.status = 'rejected';
    request.rejectionReason = (req.body && req.body.reason) || undefined;
    request.handledByOperatorId = req.operator._id;
    request.handledAt = new Date();
    await request.save();

    await auditLog({
      institutionId: request.institutionId, ...actorFromReq(req),
      action: 'REJECT_SLUG_CHANGE', entityType: 'Institution', entityId: request.institutionId,
      entityLabel: `Slug request: ${request.requestedSlug}`,
      ip: req.ip,
    });

    return ok(res, S.SLUG_REQUEST_REJECTED, null);
  } catch (err) {
    next(err);
  }
};
