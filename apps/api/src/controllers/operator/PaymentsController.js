'use strict';

const Payment     = require('../../models/Payment');
const RentInvoice = require('../../models/RentInvoice');
const { auditLog, actorFromReq } = require('../../config/auditLog');
const { ok, notFound, badRequest, paginated } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator money views (read + rent mark-paid). Two streams:
//   1. Student fees  — Payment docs across all institutions (tagged)
//   2. Rent invoices — what each autonomous institution owes Max Music
// The app TRACKS money; it does not ROUTE it.
// ─────────────────────────────────────────────────────────────────────────────

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function paymentRow(p) {
  return {
    _id:     String(p._id),
    student: p.studentId ? { _id: String(p.studentId._id), name: p.studentId.name } : null,
    institution: p.institutionId ? { _id: String(p.institutionId._id), name: p.institutionId.name } : null,
    type:    p.type,
    period:  p.period || null,
    amount:  p.amount,
    status:  p.status,
    method:  p.method,
    paidAt:  p.paidAt || null,
  };
}

exports.listStudentFees = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { institutionId, status, from, to } = req.query;

    const filter = {};
    if (institutionId && institutionId !== 'all') filter.institutionId = institutionId;
    if (status && status !== 'all')               filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const [result, summaryAgg] = await Promise.all([
      Payment.paginate(filter, {
        page, limit, sort: { createdAt: -1 }, lean: true,
        populate: [{ path: 'studentId', select: 'name' }, { path: 'institutionId', select: 'name' }],
      }),
      Payment.aggregate([
        { $group: {
          _id: null,
          collectedThisMonth: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'paid'] }, { $gte: ['$paidAt', monthStart()] }] }, '$amount', 0] } },
          overdue:            { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } },
          pending:            { $sum: { $cond: [{ $eq: ['$status', 'partial'] }, '$amount', 0] } },
        } },
      ]),
    ]);

    const summary = summaryAgg[0] || { collectedThisMonth: 0, overdue: 0, pending: 0 };
    const data = paginated(result.docs.map(paymentRow), result);
    data.summary = { collectedThisMonth: summary.collectedThisMonth, overdue: summary.overdue, pending: summary.pending };
    return ok(res, S.OK, data);
  } catch (err) {
    next(err);
  }
};

function invoiceRow(r) {
  const inst = r.institutionId;
  const institution = inst
    ? (inst.name !== undefined
        ? { _id: String(inst._id), name: inst.name }      // populated
        : { _id: String(inst), name: null })              // bare ObjectId
    : null;
  return {
    _id: String(r._id),
    institution,
    period:    r.period,
    amount:    r.amount,
    dueDate:   r.dueDate,
    status:    r.status,
    paidAt:    r.paidAt || null,
    reference: r.reference || null,
  };
}

exports.listRentInvoices = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { institutionId, status } = req.query;

    const filter = {};
    if (institutionId && institutionId !== 'all') filter.institutionId = institutionId;
    if (status && status !== 'all')               filter.status = status;

    const result = await RentInvoice.paginate(filter, {
      page, limit, sort: { dueDate: -1 }, lean: true,
      populate: [{ path: 'institutionId', select: 'name' }],
    });

    return ok(res, S.OK, paginated(result.docs.map(invoiceRow), result));
  } catch (err) {
    next(err);
  }
};

exports.markRentPaid = async (req, res, next) => {
  try {
    const invoice = await RentInvoice.findById(req.params.id);
    if (!invoice) return notFound(res, S.RENT_INVOICE_NOT_FOUND);
    if (invoice.status === 'paid') return badRequest(res, S.RENT_MARKED_PAID);

    const { reference } = req.body || {};
    const prev = invoice.status;
    invoice.status            = 'paid';
    invoice.paidAt            = new Date();
    invoice.reference         = reference || invoice.reference;
    invoice.markedByOperatorId = req.operator._id;
    await invoice.save();

    await auditLog({
      institutionId: invoice.institutionId,
      ...actorFromReq(req),
      action:      'MARK_RENT_PAID',
      entityType:  'RentInvoice',
      entityId:    invoice._id,
      entityLabel: `Rent: ${invoice.period}`,
      changes:     [{ field: 'status', from: prev, to: 'paid' }],
      ip:          req.ip,
    });

    return ok(res, S.RENT_MARKED_PAID, { invoice: invoiceRow(invoice.toObject()) });
  } catch (err) {
    next(err);
  }
};
