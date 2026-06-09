'use strict';

const AuditLog = require('../models/AuditLog');
const { stripSecrets } = require('./helper');

// ─────────────────────────────────────────────────────────────────────────────
// auditLog({ institutionId, actorId, actorRole, actorName, impersonatedBy,
//            action, entityType, entityId, entityLabel, changes, before, after, ip })
//
// Fire-and-forget. Uses { w: 0 } write concern so it NEVER blocks the response.
// Errors are logged to console but never thrown.
// Secrets (password, otp, etc.) are stripped from before/after.
// ─────────────────────────────────────────────────────────────────────────────

async function auditLog(entry) {
  try {
    if (!entry || !entry.institutionId || !entry.actorRole || !entry.action ||
        !entry.entityType || !entry.entityId) {
      console.warn('[audit] dropping malformed entry', entry);
      return;
    }

    const doc = {
      institutionId:  entry.institutionId,
      actorId:        String(entry.actorId || 'system'),
      actorRole:      entry.actorRole,
      actorName:      entry.actorName || 'System',
      impersonatedBy: entry.impersonatedBy || undefined,
      action:         entry.action,
      entityType:     entry.entityType,
      entityId:       String(entry.entityId),
      entityLabel:    entry.entityLabel,
      changes:        Array.isArray(entry.changes) && entry.changes.length ? entry.changes : undefined,
      before:         entry.before ? stripSecrets(entry.before) : undefined,
      after:          entry.after  ? stripSecrets(entry.after)  : undefined,
      ip:             entry.ip,
    };

    AuditLog.create([doc], { writeConcern: { w: 0 } }).catch(err =>
      console.error('[audit] write failed', err.message)
    );
  } catch (err) {
    console.error('[audit] dispatch failed', err.message);
  }
}

function diff(before, after, fields) {
  const changes = [];
  for (const f of fields) {
    const b = before ? before[f] : undefined;
    const a = after  ? after[f]  : undefined;
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push({ field: f, from: b, to: a });
    }
  }
  return changes;
}

function actorFromReq(req) {
  if (req.actor) {
    return {
      actorId:        req.actor._id,
      actorRole:      req.actor.role,
      actorName:      req.actor.name,
      impersonatedBy: req.actor.impersonatedBy || undefined,
    };
  }
  if (req.operator) {
    return {
      actorId:        req.operator._id,
      actorRole:      'superadmin',
      actorName:      req.operator.name,
      impersonatedBy: undefined,
    };
  }
  return { actorId: 'system', actorRole: 'system', actorName: 'System' };
}

module.exports = { auditLog, diff, actorFromReq };
