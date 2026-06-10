'use strict';

const Batch   = require('../../../models/Batch');
const Student = require('../../../models/Student');
const Holiday = require('../../../models/Holiday');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin holiday management. GOLDEN RULE: scoped to req.institution._id.
// A holiday credits one class back to matching-category students of the batch.
// `allBatches: true` fans out one holiday per active batch (festival days).
// ─────────────────────────────────────────────────────────────────────────────

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }
function dayStart(d) { return new Date(dayKey(d)); }

function rowOf(h) {
  return {
    _id: String(h._id),
    batch: h.batchId ? { _id: String(h.batchId._id), name: h.batchId.name } : null,
    date: h.date,
    studentCategory: h.studentCategory,
    reason: h.reason || null,
  };
}

async function declareForBatch(req, batch, { date, studentCategory, reason }) {
  const inst = req.institution._id;
  const holiday = await Holiday.create({
    institutionId: inst, batchId: batch._id, date: dayStart(date), studentCategory,
    reason: reason || undefined, creditsApplied: true,
    createdBy: { actorId: String(req.actor._id), actorRole: req.actor.role },
  });

  // Credit one class back to matching-category students in this batch.
  await Student.updateMany(
    { institutionId: inst, batchId: batch._id, category: studentCategory },
    { $inc: { paidClasses: 1 } }
  );

  await auditLog({
    institutionId: inst, ...actorFromReq(req),
    action: 'CREATE_HOLIDAY', entityType: 'Holiday', entityId: holiday._id,
    entityLabel: `Holiday: ${batch.name} ${dayKey(date)}`, ip: req.ip,
  });

  return holiday;
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const filter = { institutionId: inst };
    if (req.query.batchId) filter.batchId = req.query.batchId;

    const holidays = await Holiday.find(filter)
      .populate({ path: 'batchId', select: 'name' }).sort({ date: -1 }).lean();
    return ok(res, S.OK, { holidays: holidays.map(rowOf) });
  } catch (err) {
    next(err);
  }
};

exports.declare = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { batchId, allBatches, date, studentCategory, reason } = req.body || {};
    if (!date || !['regular', 'trial'].includes(studentCategory)) return badRequest(res, S.VALIDATION_FAILED);
    if (!batchId && !allBatches) return badRequest(res, S.VALIDATION_FAILED);

    let batches;
    if (allBatches) {
      batches = await Batch.find({ institutionId: inst, status: 'active' }).select('name');
      if (!batches.length) return badRequest(res, S.BATCH_NOT_FOUND);
    } else {
      const batch = await Batch.findOne({ _id: batchId, institutionId: inst }).select('name');
      if (!batch) return notFound(res, S.BATCH_NOT_FOUND);
      batches = [batch];
    }

    const out = [];
    for (const batch of batches) {
      // Skip batches that already have a holiday on that date (idempotent fan-out).
      const dup = await Holiday.exists({ institutionId: inst, batchId: batch._id, date: dayStart(date) });
      if (dup) continue;
      const holiday = await declareForBatch(req, batch, { date, studentCategory, reason });
      out.push({ ...rowOf(holiday), batch: { _id: String(batch._id), name: batch.name } });
    }

    return created(res, S.HOLIDAY_DECLARED, { holidays: out, declared: out.length });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const holiday = await Holiday.findOne({ _id: req.params.id, institutionId: inst });
    if (!holiday) return notFound(res, S.NOT_FOUND);

    // Reverse the credit if it was applied.
    if (holiday.creditsApplied) {
      await Student.updateMany(
        { institutionId: inst, batchId: holiday.batchId, category: holiday.studentCategory },
        { $inc: { paidClasses: -1 } }
      );
    }
    await Holiday.deleteOne({ _id: holiday._id, institutionId: inst });

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'DELETE_HOLIDAY', entityType: 'Holiday', entityId: holiday._id,
      entityLabel: `Holiday: ${dayKey(holiday.date)}`, ip: req.ip,
    });

    return ok(res, S.DELETED, null);
  } catch (err) {
    next(err);
  }
};
