'use strict';

const EnrollmentRequest = require('../../../models/EnrollmentRequest');
const Student = require('../../../models/Student');
const Batch   = require('../../../models/Batch');
const { nextDisplayId } = require('../../../config/specialFunctions');
const { studentRefsValid } = require('../../../config/refGuard');
const { hash, randomTempPassword } = require('../../../config/password');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
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

    const reqDoc = await EnrollmentRequest.create({
      institutionId: inst,
      name: String(name).trim(),
      mobile: String(mobile).trim(),
      email: email ? String(email).toLowerCase().trim() : undefined,
      preferredDayPatternId: preferredDayPatternId || undefined,
      preferredTimeSlotId:   preferredTimeSlotId || undefined,
      instrumentId:          instrumentId || undefined,
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

    const {
      teacherId, batchId, instrumentId, classType,
      validityDays, paidAmount, paymentStatus,
    } = req.body || {};

    // GOLDEN RULE: reject foreign teacher/batch/instrument refs before creating the Student.
    if (!(await studentRefsValid(inst, { teacherId, batchId, instrumentId }))) {
      return badRequest(res, S.STUDENT_BAD_REFS);
    }

    const displayId = await nextDisplayId(inst, 'student');
    const tempPassword = randomTempPassword();
    const passwordHash = await hash(tempPassword);

    const now = new Date();
    let validityStart, validityEnd;
    if (validityDays && Number(validityDays) > 0) {
      validityStart = now;
      validityEnd = new Date(now.getTime() + Number(validityDays) * 24 * 60 * 60 * 1000);
    }

    const student = await Student.create({
      institutionId: inst,
      displayId,
      name:   reqDoc.name,
      mobile: reqDoc.mobile,
      email:  reqDoc.email,
      teacherId:    teacherId || undefined,
      batchId:      batchId || undefined,
      instrumentId: instrumentId || reqDoc.instrumentId || undefined,
      classType:    classType || undefined,
      joinStatus:   'trial',
      category:     paymentStatus === 'paid' ? 'regular' : 'trial',
      validityStart, validityEnd,
      validityDays: validityDays ? Number(validityDays) : undefined,
      paidAmount:   typeof paidAmount === 'number' ? paidAmount : 0,
      requestId:    reqDoc._id,
      passwordHash,
      status: 'active',
    });

    if (batchId) {
      await Batch.updateOne({ _id: batchId, institutionId: inst }, { $inc: { studentCount: 1 } });
    }

    reqDoc.status = 'approved';
    reqDoc.paymentStatus = paymentStatus === 'paid' ? 'paid' : reqDoc.paymentStatus;
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
      after: { displayId: student.displayId, joinStatus: student.joinStatus, paidAmount: student.paidAmount },
      ip: req.ip,
    });

    // tempPassword surfaced ONCE for the admin to relay (Phase 7 emails it instead).
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
