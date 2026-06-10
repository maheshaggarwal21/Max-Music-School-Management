'use strict';

const Batch        = require('../../../models/Batch');
const ClassSession = require('../../../models/ClassSession');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Batch class sessions (Overview tab): launch a session by feeding a meeting
// link for a target date; list the archive. GOLDEN RULE: batch and sessions are
// both scoped to req.institution._id.
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

function rowOf(s) {
  return {
    _id:        String(s._id),
    meetingUrl: s.meetingUrl,
    targetDate: s.targetDate,
    launchedAt: s.createdAt,
    launchedBy: s.launchedBy ? { actorRole: s.launchedBy.actorRole } : null,
  };
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('name').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

    const result = await ClassSession.paginate(
      { institutionId: inst, batchId: batch._id },
      { page, limit, sort: { targetDate: -1, createdAt: -1 }, lean: true }
    );
    return ok(res, S.OK, paginated(result.docs.map(rowOf), result));
  } catch (err) {
    next(err);
  }
};

exports.launch = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { meetingUrl, targetDate } = req.body || {};
    if (!meetingUrl || !String(meetingUrl).trim()) return badRequest(res, S.VALIDATION_FAILED);

    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('name teacherId').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    let url;
    try {
      url = new URL(String(meetingUrl).trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    } catch {
      return badRequest(res, S.VALIDATION_FAILED);
    }

    const when = targetDate ? new Date(targetDate) : new Date();
    if (Number.isNaN(when.getTime())) return badRequest(res, S.VALIDATION_FAILED);

    const session = await ClassSession.create({
      institutionId: inst,
      batchId: batch._id,
      teacherId: batch.teacherId || undefined,
      meetingUrl: url.toString(),
      targetDate: when,
      launchedBy: { actorId: String(req.actor._id), actorRole: req.actor.role },
    });

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'LAUNCH_SESSION', entityType: 'ClassSession', entityId: session._id,
      entityLabel: `Session: ${batch.name} ${dayKey(when)}`, ip: req.ip,
    });

    return created(res, S.SESSION_LAUNCHED, { session: rowOf(session) });
  } catch (err) {
    next(err);
  }
};
