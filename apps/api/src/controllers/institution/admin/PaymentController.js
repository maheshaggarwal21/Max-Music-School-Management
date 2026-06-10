'use strict';

const mongoose = require('mongoose');
const Payment = require('../../../models/Payment');
const Student = require('../../../models/Student');
const RazorpayWebhookEvent = require('../../../models/RazorpayWebhookEvent');
const { auditLog, actorFromReq } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound, paginated } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin payments. GOLDEN RULE: scoped to req.institution._id. The app TRACKS
// money, it does not ROUTE it. Manual fee entry writes a Payment ledger row;
// a paid fee bumps the student's running paidAmount. The Razorpay webhook feed
// is READ-ONLY reconciliation.
// ─────────────────────────────────────────────────────────────────────────────

function paymentRow(p) {
  return {
    _id:     String(p._id),
    student: p.studentId ? { _id: String(p.studentId._id), name: p.studentId.name } : null,
    type:    p.type,
    period:  p.period || null,
    amount:  p.amount,
    status:  p.status,
    method:  p.method,
    paidAt:  p.paidAt || null,
  };
}

exports.list = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { status, from, to } = req.query;

    const filter = { institutionId: inst };
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const result = await Payment.paginate(filter, {
      page, limit, sort: { createdAt: -1 }, lean: true,
      populate: [{ path: 'studentId', select: 'name' }],
    });
    return ok(res, S.OK, paginated(result.docs.map(paymentRow), result));
  } catch (err) {
    next(err);
  }
};

exports.createPayment = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { studentId, type, amount, period, method, status, paidAt } = req.body || {};
    if (!studentId || !mongoose.isValidObjectId(studentId) ||
        !['fee', 'admission'].includes(type) || typeof amount !== 'number' || amount < 0) {
      return badRequest(res, S.VALIDATION_FAILED);
    }
    if (!['paid', 'overdue', 'partial', 'free'].includes(status)) return badRequest(res, S.VALIDATION_FAILED);

    const student = await Student.findOne({ _id: studentId, institutionId: inst }).select('name teacherId paidAmount');
    if (!student) return notFound(res, S.STUDENT_NOT_FOUND);

    const payment = await Payment.create({
      institutionId: inst,
      studentId: student._id,
      teacherId: student.teacherId || undefined,
      type,
      period: period || undefined,
      amount,
      status,
      method: method || 'manual',
      paidAt: status === 'paid' ? (paidAt ? new Date(paidAt) : new Date()) : (paidAt ? new Date(paidAt) : undefined),
      recordedBy: { actorId: String(req.actor._id), actorRole: req.actor.role },
    });

    // A paid fee advances the student's running total (the ledger is the source).
    if (status === 'paid' && type === 'fee') {
      await Student.updateOne({ _id: student._id, institutionId: inst }, { $inc: { paidAmount: amount } });
    }

    await auditLog({
      institutionId: inst,
      ...actorFromReq(req),
      action: 'CREATE_PAYMENT',
      entityType: 'Payment',
      entityId: payment._id,
      entityLabel: `Payment: ${student.name} ${amount}`,
      after: { type, amount, status, method: payment.method },
      ip: req.ip,
    });

    const full = await Payment.findOne({ _id: payment._id, institutionId: inst }).populate({ path: 'studentId', select: 'name' }).lean();
    return created(res, S.CREATED, { payment: paymentRow(full) });
  } catch (err) {
    next(err);
  }
};

exports.reconciliationFeed = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const result = await RazorpayWebhookEvent.paginate(
      { institutionId: inst },
      { page, limit, sort: { receivedAt: -1 }, lean: true }
    );

    const items = result.docs.map(e => ({
      _id:        String(e._id),
      eventType:  e.eventType,
      paymentId:  e.paymentId || null,
      amount:     typeof e.amount === 'number' ? e.amount : null,
      contact:    e.contact || null,
      payerName:  e.payerName || null,
      status:     e.status || null,
      receivedAt: e.receivedAt,
    }));
    return ok(res, S.OK, paginated(items, result));
  } catch (err) {
    next(err);
  }
};
