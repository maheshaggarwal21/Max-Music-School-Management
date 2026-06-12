'use strict';

const DayPattern = require('../../../models/DayPattern');
const TimeSlot   = require('../../../models/TimeSlot');
const Instrument = require('../../../models/Instrument');
const PlatformSettings = require('../../../models/PlatformSettings');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Suitable Days (DayPattern) + Suitable Times (TimeSlot) — reusable building
// blocks for batches. GOLDEN RULE: scoped to req.institution._id. Labels are
// derived by model hooks. Unique compound indexes guard duplicates → 400.
// ─────────────────────────────────────────────────────────────────────────────

const dayItem  = d => ({ _id: String(d._id), days: d.days, label: d.label, isActive: d.isActive });
const slotItem = t => ({ _id: String(t._id), startTime: t.startTime, endTime: t.endTime, label: t.label, isOnline: t.isOnline });
const instrItem = i => ({ _id: String(i._id), name: i.name, isActive: i.isActive });

// ── Instruments (read-only reference list; instruments are provisioned per
// institution by the operator). Powers batch + enrollment-request dropdowns. ──
exports.listInstruments = async (req, res, next) => {
  try {
    const inst = req.institution._id;

    // Sync this institution's instruments to mirror the operator's GLOBAL catalog
    // (PlatformSettings.instruments), which is "available to every institution".
    // Catalog-sourced rows (fromCatalog:true) track the catalog's active set by
    // name: created when added, reactivated when re-enabled, DEACTIVATED (never
    // deleted — batches reference them) when removed/disabled. Institution-specific
    // or seeded instruments (fromCatalog:false) are never touched.
    const ps = await PlatformSettings.getSingleton();
    const activeCatalog = (ps.instruments || [])
      .filter(i => i.isActive !== false)
      .map(i => String(i.name || '').trim())
      .filter(Boolean);
    const activeSet = new Set(activeCatalog.map(n => n.toLowerCase()));

    const existing = await Instrument.find({ institutionId: inst }).lean();
    const byName = new Map(existing.map(i => [i.name.toLowerCase(), i]));

    const ops = [];
    // 1. Every active catalog instrument must exist, be active, and be flagged.
    for (const name of activeCatalog) {
      const cur = byName.get(name.toLowerCase());
      if (!cur) {
        ops.push({ insertOne: { document: { institutionId: inst, name, isActive: true, fromCatalog: true } } });
      } else if (!cur.isActive || !cur.fromCatalog) {
        // reactivate + mark as catalog-sourced (self-heals rows materialized earlier)
        ops.push({ updateOne: { filter: { _id: cur._id }, update: { $set: { isActive: true, fromCatalog: true } } } });
      }
    }
    // 2. Catalog-sourced rows dropped from the active catalog → deactivate (keep refs).
    for (const i of existing) {
      if (i.fromCatalog && i.isActive && !activeSet.has(i.name.toLowerCase())) {
        ops.push({ updateOne: { filter: { _id: i._id }, update: { $set: { isActive: false } } } });
      }
    }
    if (ops.length) {
      try { await Instrument.bulkWrite(ops, { ordered: false }); }
      catch (e) { if (!e || e.code !== 11000) throw e; } // ignore dup-name races
    }

    // Dropdowns only ever want ACTIVE instruments.
    const items = await Instrument.find({ institutionId: inst, isActive: true }).sort({ name: 1 }).lean();
    return ok(res, S.OK, { instruments: items.map(instrItem) });
  } catch (err) {
    next(err);
  }
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// ── Day patterns ───────────────────────────────────────────────────────────────
exports.listDayPatterns = async (req, res, next) => {
  try {
    const items = await DayPattern.find({ institutionId: req.institution._id }).sort({ createdAt: -1 }).lean();
    return ok(res, S.OK, { dayPatterns: items.map(dayItem) });
  } catch (err) {
    next(err);
  }
};

exports.createDayPattern = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const days = (req.body && req.body.days) || [];
    if (!Array.isArray(days) || !days.length || !days.every(d => DAY_ENUM.includes(d))) {
      return badRequest(res, S.VALIDATION_FAILED);
    }
    let doc;
    try {
      doc = await DayPattern.create({ institutionId: inst, days });
    } catch (e) {
      if (e && e.code === 11000) return badRequest(res, S.DAY_PATTERN_DUPLICATE);
      throw e;
    }
    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'CREATE_DAY_PATTERN', entityType: 'DayPattern', entityId: doc._id,
      entityLabel: `Days: ${doc.label}`, ip: req.ip,
    });
    return created(res, S.CREATED, { dayPattern: dayItem(doc) });
  } catch (err) {
    next(err);
  }
};

exports.toggleDayPattern = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const doc = await DayPattern.findOne({ _id: req.params.id, institutionId: inst });
    if (!doc) return notFound(res, S.NOT_FOUND);
    if (typeof (req.body && req.body.isActive) !== 'boolean') return badRequest(res, S.VALIDATION_FAILED);

    const from = doc.isActive;
    doc.isActive = req.body.isActive;
    await doc.save();

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'UPDATE_DAY_PATTERN', entityType: 'DayPattern', entityId: doc._id,
      entityLabel: `Days: ${doc.label}`, changes: [{ field: 'isActive', from, to: doc.isActive }], ip: req.ip,
    });
    return ok(res, S.UPDATED, { dayPattern: dayItem(doc) });
  } catch (err) {
    next(err);
  }
};

// ── Time slots ─────────────────────────────────────────────────────────────────
exports.listTimeSlots = async (req, res, next) => {
  try {
    const items = await TimeSlot.find({ institutionId: req.institution._id }).sort({ startTime: 1 }).lean();
    return ok(res, S.OK, { timeSlots: items.map(slotItem) });
  } catch (err) {
    next(err);
  }
};

exports.createTimeSlot = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { startTime, endTime } = req.body || {};
    if (!HHMM.test(startTime || '') || !HHMM.test(endTime || '')) return badRequest(res, S.VALIDATION_FAILED);
    if (endTime <= startTime) return badRequest(res, S.TIME_SLOT_RANGE_INVALID);

    let doc;
    try {
      doc = await TimeSlot.create({ institutionId: inst, startTime, endTime });
    } catch (e) {
      if (e && e.code === 11000) return badRequest(res, S.TIME_SLOT_DUPLICATE);
      throw e;
    }
    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'CREATE_TIME_SLOT', entityType: 'TimeSlot', entityId: doc._id,
      entityLabel: `Time: ${doc.label}`, ip: req.ip,
    });
    return created(res, S.CREATED, { timeSlot: slotItem(doc) });
  } catch (err) {
    next(err);
  }
};

exports.toggleTimeSlot = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const doc = await TimeSlot.findOne({ _id: req.params.id, institutionId: inst });
    if (!doc) return notFound(res, S.NOT_FOUND);
    if (typeof (req.body && req.body.isOnline) !== 'boolean') return badRequest(res, S.VALIDATION_FAILED);

    const from = doc.isOnline;
    doc.isOnline = req.body.isOnline;
    await doc.save();

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'UPDATE_TIME_SLOT', entityType: 'TimeSlot', entityId: doc._id,
      entityLabel: `Time: ${doc.label}`, changes: [{ field: 'isOnline', from, to: doc.isOnline }], ip: req.ip,
    });
    return ok(res, S.UPDATED, { timeSlot: slotItem(doc) });
  } catch (err) {
    next(err);
  }
};
