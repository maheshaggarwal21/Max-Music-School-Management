'use strict';

const AuditLog = require('../../models/AuditLog');
const { ok, paginated } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL "Changes History" — the cross-institution AuditLog timeline.
// Same collection that powers per-student activity feeds, here unfiltered by
// institution (god-mode). before/after were already secret-stripped at write time.
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function serialize(a) {
  return {
    _id: String(a._id),
    institution: a.institutionId
      ? { _id: String(a.institutionId._id), name: a.institutionId.name }
      : null,
    actorRole:      a.actorRole,
    actorName:      a.actorName,
    impersonatedBy: a.impersonatedBy ? String(a.impersonatedBy) : null,
    action:         a.action,
    entityType:     a.entityType,
    entityId:       a.entityId,
    entityLabel:    a.entityLabel || null,
    changes:        a.changes || [],
    before:         a.before || null,
    after:          a.after || null,
    ip:             a.ip || null,
    createdAt:      a.createdAt,
  };
}

exports.list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { institutionId, entityType, action, actorRole, actorName, from, to } = req.query;

    const filter = {};
    if (institutionId) filter.institutionId = institutionId;
    if (entityType)    filter.entityType = entityType;
    if (action)        filter.action = action;
    if (actorRole && actorRole !== 'all') filter.actorRole = actorRole;
    if (actorName)     filter.actorName = new RegExp(escapeRegex(actorName), 'i');
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const result = await AuditLog.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
      populate: [{ path: 'institutionId', select: 'name' }],
    });

    return ok(res, S.OK, paginated(result.docs.map(serialize), result));
  } catch (err) {
    next(err);
  }
};
