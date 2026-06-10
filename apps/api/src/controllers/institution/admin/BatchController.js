'use strict';

const Batch      = require('../../../models/Batch');
const Instrument = require('../../../models/Instrument');
const DayPattern = require('../../../models/DayPattern');
const TimeSlot   = require('../../../models/TimeSlot');
const { encodeBatchName } = require('../../../config/specialFunctions');
const { auditLog, actorFromReq, diff } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin batch management. GOLDEN RULE: scoped to req.institution._id, and every
// referenced instrument/day-pattern/time-slot/teacher is verified to belong to
// THIS institution before use. Batch name is auto-encoded when omitted.
// Batch with no teacher = "Setting Phase" (status 'setting').
// ─────────────────────────────────────────────────────────────────────────────

const POPULATE = [
  { path: 'instrumentId', select: 'name' },
  { path: 'dayPatternId', select: 'label days' },
  { path: 'timeSlotId',   select: 'label startTime endTime' },
  { path: 'teacherId',    select: 'name' },
];

function rowOf(b) {
  return {
    _id:  String(b._id),
    name: b.name,
    instrument: b.instrumentId ? { _id: String(b.instrumentId._id), name: b.instrumentId.name } : null,
    dayPattern: b.dayPatternId ? { _id: String(b.dayPatternId._id), label: b.dayPatternId.label } : null,
    timeSlot:   b.timeSlotId ? { _id: String(b.timeSlotId._id), label: b.timeSlotId.label } : null,
    teacher:    b.teacherId ? { _id: String(b.teacherId._id), name: b.teacherId.name } : null,
    studentCount: b.studentCount || 0,
    status: b.status,
  };
}

// Resolve the three scoped refs and build an encoded name. Returns null if any
// ref is missing/foreign (caller turns that into a 400).
async function encodeName(inst, { instrumentId, dayPatternId, timeSlotId, mode }) {
  const [instr, day, slot] = await Promise.all([
    instrumentId ? Instrument.findOne({ _id: instrumentId, institutionId: inst }).lean() : null,
    dayPatternId ? DayPattern.findOne({ _id: dayPatternId, institutionId: inst }).lean() : null,
    timeSlotId   ? TimeSlot.findOne({ _id: timeSlotId, institutionId: inst }).lean() : null,
  ]);
  return encodeBatchName({
    instrumentName: instr ? instr.name : '',
    startTime: slot ? slot.startTime : undefined,
    endTime:   slot ? slot.endTime : undefined,
    days:      day ? day.days : [],
    mode:      mode || 'online',
  });
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { status } = req.query;

    const filter = { institutionId: inst };
    if (status) filter.status = status;

    const result = await Batch.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: POPULATE,
    });
    return ok(res, S.OK, paginated(result.docs.map(rowOf), result));
  } catch (err) {
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const b = await Batch.findOne({ _id: req.params.id, institutionId: inst })
      .populate(POPULATE).lean();
    if (!b) return notFound(res, S.BATCH_NOT_FOUND);
    return ok(res, S.OK, {
      batch: {
        ...rowOf(b),
        mode: b.mode,
        dayPatternDays: (b.dayPatternId && b.dayPatternId.days) || [],
        timeRange: b.timeSlotId
          ? { startTime: b.timeSlotId.startTime, endTime: b.timeSlotId.endTime }
          : null,
        createdAt: b.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.students = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst }).select('name').lean();
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const Student = require('../../../models/Student');
    const students = await Student
      .find({ institutionId: inst, batchId: batch._id })
      .select('displayId name mobile joinStatus category validityEnd paidClasses')
      .sort({ name: 1 }).lean();

    return ok(res, S.OK, {
      batch: { _id: String(batch._id), name: batch.name },
      students: students.map(s => ({
        _id: String(s._id), displayId: s.displayId, name: s.name, mobile: s.mobile,
        joinStatus: s.joinStatus, category: s.category,
        validityEnd: s.validityEnd || null, paidClasses: s.paidClasses || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { name, instrumentId, dayPatternId, timeSlotId, teacherId, mode } = req.body || {};
    if (!instrumentId || !dayPatternId || !timeSlotId) return badRequest(res, S.VALIDATION_FAILED);

    // Verify every ref belongs to THIS institution.
    const [instr, day, slot] = await Promise.all([
      Instrument.exists({ _id: instrumentId, institutionId: inst }),
      DayPattern.exists({ _id: dayPatternId, institutionId: inst }),
      TimeSlot.exists({ _id: timeSlotId, institutionId: inst }),
    ]);
    if (!instr || !day || !slot) return badRequest(res, S.BATCH_BAD_REFS);
    if (teacherId) {
      const Teacher = require('../../../models/Teacher');
      const owns = await Teacher.exists({ _id: teacherId, institutionId: inst });
      if (!owns) return badRequest(res, S.BATCH_BAD_REFS);
    }

    const encoded = (name && name.trim())
      ? name.trim()
      : await encodeName(inst, { instrumentId, dayPatternId, timeSlotId, mode });

    const batch = await Batch.create({
      institutionId: inst,
      name: encoded,
      instrumentId, dayPatternId, timeSlotId,
      teacherId: teacherId || undefined,
      mode: mode || 'online',
      status: teacherId ? 'active' : 'setting',
    });

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'CREATE_BATCH',
      entityType: 'Batch',
      entityId: batch._id,
      entityLabel: `Batch: ${batch.name}`,
      ip: req.ip,
    });

    const full = await Batch.findOne({ _id: batch._id, institutionId: inst }).populate(POPULATE).lean();
    return created(res, S.BATCH_CREATED, { batch: rowOf(full) });
  } catch (err) {
    next(err);
  }
};

exports.patch = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const batch = await Batch.findOne({ _id: req.params.id, institutionId: inst });
    if (!batch) return notFound(res, S.BATCH_NOT_FOUND);

    const before = batch.toObject();
    const fields = ['instrumentId', 'dayPatternId', 'timeSlotId', 'teacherId', 'mode', 'status', 'name'];
    let coreChanged = false;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        batch[f] = req.body[f];
        if (['instrumentId', 'dayPatternId', 'timeSlotId', 'mode'].includes(f)) coreChanged = true;
      }
    }

    // Verify any newly-set refs belong to this institution.
    const checks = [];
    if (req.body.instrumentId) checks.push(Instrument.exists({ _id: batch.instrumentId, institutionId: inst }));
    if (req.body.dayPatternId) checks.push(DayPattern.exists({ _id: batch.dayPatternId, institutionId: inst }));
    if (req.body.timeSlotId)   checks.push(TimeSlot.exists({ _id: batch.timeSlotId, institutionId: inst }));
    if (req.body.teacherId) {
      const Teacher = require('../../../models/Teacher');
      checks.push(Teacher.exists({ _id: batch.teacherId, institutionId: inst }));
    }
    if (checks.length && (await Promise.all(checks)).some(x => !x)) {
      return badRequest(res, S.BATCH_BAD_REFS);
    }

    // Re-encode name when a core field changed and the caller didn't pin a name.
    if (coreChanged && req.body.name === undefined) {
      batch.name = await encodeName(inst, {
        instrumentId: batch.instrumentId, dayPatternId: batch.dayPatternId,
        timeSlotId: batch.timeSlotId, mode: batch.mode,
      });
    }
    // Assigning a teacher to a setting-phase batch activates it.
    if (req.body.teacherId && batch.status === 'setting') batch.status = 'active';

    await batch.save();

    const changes = diff(before, batch.toObject(), fields);
    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'UPDATE_BATCH',
      entityType: 'Batch',
      entityId: batch._id,
      entityLabel: `Batch: ${batch.name}`,
      changes,
      ip: req.ip,
    });

    const full = await Batch.findOne({ _id: batch._id, institutionId: inst }).populate(POPULATE).lean();
    return ok(res, S.BATCH_UPDATED, { batch: rowOf(full) });
  } catch (err) {
    next(err);
  }
};
