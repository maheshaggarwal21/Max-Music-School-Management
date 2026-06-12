'use strict';

const ClassLevel = require('../../../models/ClassLevel');
const Student    = require('../../../models/Student');
const { auditLog, actorFromReq, diff } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Class levels — reusable fee+duration templates per institution that pre-fill a
// student's total fee and validity days at enrollment. GOLDEN RULE: every query
// scoped to req.institution._id. Mirrors the DayPattern CRUD shape. Never hard-
// deleted while referenced by students (deactivate via isActive instead).
// ─────────────────────────────────────────────────────────────────────────────

const item = c => ({
  _id:            String(c._id),
  name:           c.name,
  paidAmount:     c.paidAmount || 0,
  upcomingAmount: c.upcomingAmount || 0,
  days:           c.days,
  isActive:       c.isActive,
});

function parseAmounts(body) {
  const upcomingAmount = Number(body.upcomingAmount);
  const days           = Number(body.days);
  const paidAmount     = body.paidAmount === undefined || body.paidAmount === null || body.paidAmount === ''
    ? 0 : Number(body.paidAmount);
  return { upcomingAmount, days, paidAmount };
}

exports.list = async (req, res, next) => {
  try {
    const filter = { institutionId: req.institution._id };
    if (req.query.active === '1' || req.query.active === 'true') filter.isActive = true;
    const items = await ClassLevel.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, S.OK, { classLevels: items.map(item) });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const { upcomingAmount, days, paidAmount } = parseAmounts(req.body);
    if (!name || !Number.isFinite(upcomingAmount) || upcomingAmount < 0 ||
        !Number.isFinite(days) || days < 1 || !Number.isFinite(paidAmount) || paidAmount < 0) {
      return badRequest(res, S.VALIDATION_FAILED);
    }

    let doc;
    try {
      doc = await ClassLevel.create({ institutionId: inst, name, upcomingAmount, days, paidAmount: paidAmount || 0 });
    } catch (e) {
      if (e && e.code === 11000) return badRequest(res, S.CLASS_LEVEL_DUPLICATE);
      throw e;
    }

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'CREATE_CLASS_LEVEL', entityType: 'ClassLevel', entityId: doc._id,
      entityLabel: `Class: ${doc.name}`, ip: req.ip,
    });
    return created(res, S.CLASS_LEVEL_CREATED, { classLevel: item(doc) });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const doc = await ClassLevel.findOne({ _id: req.params.id, institutionId: inst });
    if (!doc) return notFound(res, S.CLASS_LEVEL_NOT_FOUND);

    const before = doc.toObject();
    if (typeof req.body.name === 'string' && req.body.name.trim()) doc.name = req.body.name.trim();
    if (req.body.upcomingAmount !== undefined) {
      const n = Number(req.body.upcomingAmount);
      if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
      doc.upcomingAmount = n;
    }
    if (req.body.paidAmount !== undefined) {
      const n = Number(req.body.paidAmount);
      if (!Number.isFinite(n) || n < 0) return badRequest(res, S.VALIDATION_FAILED);
      doc.paidAmount = n;
    }
    if (req.body.days !== undefined) {
      const n = Number(req.body.days);
      if (!Number.isFinite(n) || n < 1) return badRequest(res, S.VALIDATION_FAILED);
      doc.days = n;
    }
    if (typeof req.body.isActive === 'boolean') doc.isActive = req.body.isActive;

    try {
      await doc.save();
    } catch (e) {
      if (e && e.code === 11000) return badRequest(res, S.CLASS_LEVEL_DUPLICATE);
      throw e;
    }

    const changes = diff(before, doc.toObject(), ['name', 'paidAmount', 'upcomingAmount', 'days', 'isActive']);
    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'UPDATE_CLASS_LEVEL', entityType: 'ClassLevel', entityId: doc._id,
      entityLabel: `Class: ${doc.name}`, changes, ip: req.ip,
    });
    return ok(res, S.CLASS_LEVEL_UPDATED, { classLevel: item(doc) });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const doc = await ClassLevel.findOne({ _id: req.params.id, institutionId: inst });
    if (!doc) return notFound(res, S.CLASS_LEVEL_NOT_FOUND);
    if (await Student.exists({ classLevelId: doc._id, institutionId: inst })) {
      return badRequest(res, S.CLASS_LEVEL_IN_USE);
    }
    await ClassLevel.deleteOne({ _id: doc._id, institutionId: inst });
    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'UPDATE_CLASS_LEVEL', entityType: 'ClassLevel', entityId: doc._id,
      entityLabel: `Class: ${doc.name}`, changes: [{ field: 'deleted', from: false, to: true }], ip: req.ip,
    });
    return ok(res, S.CLASS_LEVEL_UPDATED, null);
  } catch (err) {
    next(err);
  }
};
