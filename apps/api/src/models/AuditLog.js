'use strict';
// TODO: Phase 1 — IMMUTABLE — never updated or deleted
//                 fields: institutionId (required), actorId, actorRole, actorName,
//                 impersonatedBy, action, entityType, entityId, entityLabel,
//                 changes [{ field, from, to }], before, after, ip
//                 timestamps: { createdAt: true, updatedAt: false }
//                 Written via auditLog() config with { w: 0 } — never directly
module.exports = {};
