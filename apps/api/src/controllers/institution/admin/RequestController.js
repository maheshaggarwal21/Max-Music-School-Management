'use strict';

const mongoose = require('mongoose');
const EnrollmentRequest = require('../../../models/EnrollmentRequest');
const Student = require('../../../models/Student');
const Teacher = require('../../../models/Teacher');
const Batch   = require('../../../models/Batch');
const DayPattern = require('../../../models/DayPattern');
const TimeSlot   = require('../../../models/TimeSlot');
const Instrument = require('../../../models/Instrument');
const ClassLevel = require('../../../models/ClassLevel');
const { nextDisplayId } = require('../../../config/specialFunctions');
const { studentRefsValid } = require('../../../config/refGuard');
const { derivePaymentStatus } = require('../../../config/payments');

// Resolve an optional client-supplied ref: keep it only if it is a valid
// ObjectId that belongs to THIS institution (golden rule). A bad/foreign id is
// dropped to undefined rather than thrown — these are informational preference
// hints on a lead, so a stale value must never 500 or leak another tenant's row.
async function resolveOwnedRef(model, inst, id) {
  if (!id || !mongoose.isValidObjectId(id)) return undefined;
  const found = await model.exists({ _id: id, institutionId: inst });
  return found ? id : undefined;
}

// Clean + validate the admin Add-Student form's "proposed" student config carried
// on a request. Foreign/invalid refs and out-of-range values are dropped (never
// thrown) so a stale proposal can't 500 or leak another tenant's row. paymentStatus
// is intentionally NOT carried — it is always derived at student creation.
const PROPOSED_ENUMS = {
  mode:        ['online', 'offline'],
  sessionType: ['live', 'all'],
  joinStatus:  ['trial', 'active_soon', 'active', 'inactive'],
  category:    ['regular', 'trial'],
  gender:      ['male', 'female'],
};
async function buildProposed(inst, p) {
  if (!p || typeof p !== 'object') return undefined;
  const out = {};
  const [tch, bat, instr, cls] = await Promise.all([
    resolveOwnedRef(Teacher, inst, p.teacherId),
    resolveOwnedRef(Batch, inst, p.batchId),
    resolveOwnedRef(Instrument, inst, p.instrumentId),
    resolveOwnedRef(ClassLevel, inst, p.classLevelId),
  ]);
  if (tch) out.teacherId = tch;
  if (bat) out.batchId = bat;
  if (instr) out.instrumentId = instr;
  if (cls) out.classLevelId = cls;
  for (const [k, vals] of Object.entries(PROPOSED_ENUMS)) if (vals.includes(p[k])) out[k] = p[k];
  if (typeof p.classType === 'string' && p.classType.trim()) out.classType = p.classType.trim();
  if (typeof p.remarks === 'string' && p.remarks.trim()) out.remarks = p.remarks.trim();
  for (const k of ['validityStart', 'validityEnd']) {
    if (p[k] && !Number.isNaN(new Date(p[k]).getTime())) out[k] = new Date(p[k]);
  }
  for (const k of ['validityDays', 'feeTotal', 'paidAmount', 'paidClasses', 'upcomingClasses']) {
    const n = Number(p[k]);
    if (p[k] !== undefined && p[k] !== null && p[k] !== '' && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}
const { hash, randomTempPassword } = require('../../../config/password');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const { sendMail } = require('../../../config/mailer');
const { studentWelcome } = require('../../../config/emailTemplates');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment requests (two-step: request → approve → Student).
// GOLDEN RULE: every query is scoped to req.institution._id. institutionId is
// NEVER read from the client.
// ─────────────────────────────────────────────────────────────────────────────

const POPULATE = [
  { path: 'preferredDayPatternId', select: 'label' },
  { path: 'preferredTimeSlotId',   select: 'label' },
  { path: 'instrumentId',          select: 'name' },
];

const ID_KEYS = ['classLevelId', 'teacherId', 'batchId', 'instrumentId'];
function serializeProposed(p) {
  if (!p) return null;
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue;
    if (ID_KEYS.includes(k)) out[k] = String(v);
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

function serialize(r) {
  return {
    _id:    String(r._id),
    name:   r.name,
    mobile: r.mobile,
    email:  r.email || null,
    preferredDays: r.preferredDayPatternId
      ? { _id: String(r.preferredDayPatternId._id), label: r.preferredDayPatternId.label } : null,
    preferredTime: r.preferredTimeSlotId
      ? { _id: String(r.preferredTimeSlotId._id), label: r.preferredTimeSlotId.label } : null,
    instrument: r.instrumentId
      ? { _id: String(r.instrumentId._id), name: r.instrumentId.name } : null,
    proposed:      serializeProposed(r.proposed),
    status:        r.status,
    paymentStatus: r.paymentStatus,
    createdAt:     r.createdAt,
  };
}

function actorStamp(req) {
  return { actorId: String(req.actor._id), actorRole: req.actor.role };
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { status } = req.query;

    const filter = { institutionId: inst };
    if (status && status !== 'all') filter.status = status;

    const result = await EnrollmentRequest.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true, populate: POPULATE,
    });
    return ok(res, S.OK, paginated(result.docs.map(serialize), result));
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { name, mobile, email, preferredDayPatternId, preferredTimeSlotId, instrumentId } = req.body || {};
    if (!name || !mobile) return badRequest(res, S.VALIDATION_FAILED);

    // Validate optional preference refs belong to this institution (drop if not).
    const [dayId, timeId, instrId, proposed] = await Promise.all([
      resolveOwnedRef(DayPattern, inst, preferredDayPatternId),
      resolveOwnedRef(TimeSlot,   inst, preferredTimeSlotId),
      resolveOwnedRef(Instrument, inst, instrumentId),
      buildProposed(inst, req.body.proposed),
    ]);

    const reqDoc = await EnrollmentRequest.create({
      institutionId: inst,
      name: String(name).trim(),
      mobile: String(mobile).trim(),
      email: email ? String(email).toLowerCase().trim() : undefined,
      preferredDayPatternId: dayId,
      preferredTimeSlotId:   timeId,
      // the structured Add-Student form may also send a full instrument in `proposed`
      instrumentId:          instrId || (proposed && proposed.instrumentId) || undefined,
      proposed,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'CREATE_REQUEST',
      entityType: 'EnrollmentRequest',
      entityId: reqDoc._id,
      entityLabel: `Request: ${reqDoc.name}`,
      ip: req.ip,
    });

    const full = await EnrollmentRequest.findOne({ _id: reqDoc._id, institutionId: inst }).populate(POPULATE).lean();
    return created(res, S.REQUEST_CREATED, { request: serialize(full) });
  } catch (err) {
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const reqDoc = await EnrollmentRequest.findOne({ _id: req.params.id, institutionId: inst });
    if (!reqDoc) return notFound(res, S.REQUEST_NOT_FOUND);
    if (reqDoc.status !== 'pending') return badRequest(res, S.REQUEST_NOT_PENDING);

    // The approval form (body) wins; the request's `proposed` config supplies defaults.
    const p = reqDoc.proposed || {};
    const pick = (k) => (req.body[k] !== undefined ? req.body[k] : p[k]);
    const numOr = (v) => (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

    let teacherId    = pick('teacherId');
    let batchId      = pick('batchId');
    let instrumentId = pick('instrumentId');
    let classLevelId = pick('classLevelId');
    const classType    = pick('classType');
    let validityDays   = pick('validityDays');
    let paidAmount     = pick('paidAmount');
    let feeTotal       = pick('feeTotal');
    const paymentStatus = pick('paymentStatus'); // form intent: 'paid' | 'unpaid' | 'free'
    const mode         = pick('mode');
    const sessionType  = pick('sessionType');
    const joinStatus   = pick('joinStatus');
    const gender       = pick('gender');
    const category     = pick('category');
    const remarks      = pick('remarks');
    const bodyStart    = pick('validityStart');
    const bodyEnd      = pick('validityEnd');
    const paidClasses     = pick('paidClasses');
    const upcomingClasses = pick('upcomingClasses');
    const upcomingAmount  = pick('upcomingAmount');

    // GOLDEN RULE: reject foreign teacher/batch/instrument/classLevel refs (post-merge).
    if (!(await studentRefsValid(inst, { teacherId, batchId, instrumentId, classLevelId }))) {
      return badRequest(res, S.STUDENT_BAD_REFS);
    }

    // Selecting a class level pre-fills total fee + duration (+ default paid) when not given.
    if (classLevelId) {
      const level = await ClassLevel.findOne({ _id: classLevelId, institutionId: inst }).lean();
      if (level) {
        if (feeTotal === undefined || feeTotal === null || feeTotal === '') feeTotal = level.upcomingAmount;
        if (validityDays === undefined || validityDays === null || validityDays === '') validityDays = level.days;
        if (paidAmount === undefined || paidAmount === null || paidAmount === '') paidAmount = level.paidAmount || 0;
      }
    }

    const displayId = await nextDisplayId(inst, 'student');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const now = new Date();
    // Explicit start/end dates from the approval form win; else derive from validityDays.
    let validityStart, validityEnd, effectiveDays;
    if (bodyStart && bodyEnd && !Number.isNaN(new Date(bodyStart).getTime()) && !Number.isNaN(new Date(bodyEnd).getTime())) {
      validityStart = new Date(bodyStart);
      validityEnd   = new Date(bodyEnd);
      effectiveDays = Math.max(0, Math.round((validityEnd - validityStart) / (24 * 60 * 60 * 1000)));
    } else if (validityDays && Number(validityDays) > 0) {
      validityStart = now;
      validityEnd = new Date(now.getTime() + Number(validityDays) * 24 * 60 * 60 * 1000);
      effectiveDays = Number(validityDays);
    }

    const numFee  = numOr(feeTotal) || 0;
    const numPaid = numOr(paidAmount) || 0;
    const computedPaymentStatus = derivePaymentStatus(numFee, numPaid, { forceFree: paymentStatus === 'free' });

    const student = await Student.create({
      institutionId: inst,
      displayId,
      name:   reqDoc.name,
      mobile: reqDoc.mobile,
      email:  reqDoc.email,
      teacherId:    teacherId || undefined,
      batchId:      batchId || undefined,
      instrumentId: instrumentId || reqDoc.instrumentId || undefined,
      classLevelId: classLevelId || undefined,
      classType:    classType || undefined,
      gender:       gender || undefined,
      mode:         mode || undefined,
      sessionType:  sessionType || undefined,
      joinStatus:   joinStatus || 'trial',
      category:     category || (paymentStatus === 'paid' ? 'regular' : 'trial'),
      validityStart, validityEnd,
      validityDays: effectiveDays,
      paidClasses:     numOr(paidClasses),
      upcomingClasses: numOr(upcomingClasses),
      paidAmount:   numPaid,
      upcomingAmount: numOr(upcomingAmount) !== undefined ? numOr(upcomingAmount) : (numFee || undefined),
      feeTotal:     numFee,
      paymentStatus: computedPaymentStatus,
      remarks:      remarks || undefined,
      requestId:    reqDoc._id,
      passwordHash,
      status: 'active',
    });

    if (batchId) {
      await Batch.updateOne({ _id: batchId, institutionId: inst }, { $inc: { studentCount: 1 } });
    }

    reqDoc.status = 'approved';
    reqDoc.paymentStatus = computedPaymentStatus === 'paid' ? 'paid' : reqDoc.paymentStatus;
    reqDoc.approvedStudentId = student._id;
    reqDoc.handledBy = actorStamp(req);
    reqDoc.handledAt = now;
    await reqDoc.save();

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'APPROVE_REQUEST',
      entityType: 'Student',
      entityId: student._id,
      entityLabel: `Student: ${student.name}`,
      after: {
        displayId: student.displayId, joinStatus: student.joinStatus,
        paidAmount: student.paidAmount, feeTotal: student.feeTotal,
        paymentStatus: student.paymentStatus,
      },
      ip: req.ip,
    });

    // Email the student their temporary password (fail-soft; only if email on file).
    if (student.email) {
      const slug = req.institution.slug;
      const panelUrl = `${process.env.PLATFORM_DOMAIN_URL || ''}/${slug}/student`;
      const tpl = studentWelcome({
        schoolName:   req.institution.branding.schoolName,
        primaryColor: req.institution.branding.primaryColor,
        studentName:  student.name,
        panelUrl,
        tempPassword,
      });
      sendMail({ to: student.email, ...tpl, institution: req.institution }).catch(() => {});
    }

    return created(res, S.REQUEST_APPROVED, {
      student: { _id: String(student._id), displayId: student.displayId, name: student.name },
      tempPassword,
    });
  } catch (err) {
    next(err);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const reqDoc = await EnrollmentRequest.findOne({ _id: req.params.id, institutionId: inst });
    if (!reqDoc) return notFound(res, S.REQUEST_NOT_FOUND);
    if (reqDoc.status !== 'pending') return badRequest(res, S.REQUEST_NOT_PENDING);

    reqDoc.status = 'rejected';
    reqDoc.rejectionReason = (req.body && req.body.reason) || undefined;
    reqDoc.handledBy = actorStamp(req);
    reqDoc.handledAt = new Date();
    await reqDoc.save();

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'REJECT_REQUEST',
      entityType: 'EnrollmentRequest',
      entityId: reqDoc._id,
      entityLabel: `Request: ${reqDoc.name}`,
      ip: req.ip,
    });

    return ok(res, S.REQUEST_REJECTED, null);
  } catch (err) {
    next(err);
  }
};
