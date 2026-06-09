'use strict';

const Institution = require('../../models/Institution');
const Student     = require('../../models/Student');
const Teacher     = require('../../models/Teacher');
const Payment     = require('../../models/Payment');
const RentInvoice = require('../../models/RentInvoice');
const AuditLog    = require('../../models/AuditLog');
const { ok } = require('../../config/helper');
const S = require('../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Operator landing dashboard. All aggregations are global (cross-institution).
// ─────────────────────────────────────────────────────────────────────────────

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

exports.get = async (req, res, next) => {
  try {
    const ms = monthStart();

    const [
      instTotal, instActive, instSuspended,
      studentTotal, teacherTotal,
      rentAgg, feeAgg,
      recentChangesDocs, overdueRentDocs,
    ] = await Promise.all([
      Institution.countDocuments({ status: { $ne: 'terminated' } }),
      Institution.countDocuments({ status: 'active' }),
      Institution.countDocuments({ status: 'suspended' }),
      Student.countDocuments({}),
      Teacher.countDocuments({}),
      RentInvoice.aggregate([
        { $group: {
          _id: null,
          collectedThisMonth: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'paid'] }, { $gte: ['$paidAt', ms] }] }, '$amount', 0] } },
          overdue:            { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } },
        } },
      ]),
      Payment.aggregate([
        { $match: { type: 'fee', status: 'paid', paidAt: { $gte: ms } } },
        { $group: { _id: null, collected: { $sum: '$amount' } } },
      ]),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(15)
        .populate({ path: 'institutionId', select: 'name' }).lean(),
      RentInvoice.find({ status: 'overdue' }).sort({ dueDate: 1 }).limit(15)
        .populate({ path: 'institutionId', select: 'name' }).lean(),
    ]);

    const rent = rentAgg[0] || { collectedThisMonth: 0, overdue: 0 };
    const fee  = feeAgg[0]  || { collected: 0 };

    const recentChanges = recentChangesDocs.map(a => ({
      _id: String(a._id),
      institution: a.institutionId ? { _id: String(a.institutionId._id), name: a.institutionId.name } : null,
      actorRole:   a.actorRole,
      actorName:   a.actorName,
      action:      a.action,
      entityType:  a.entityType,
      entityLabel: a.entityLabel || null,
      createdAt:   a.createdAt,
    }));

    const overdueRents = overdueRentDocs.map(r => ({
      _id: String(r._id),
      institution: r.institutionId ? { _id: String(r.institutionId._id), name: r.institutionId.name } : null,
      period:  r.period,
      amount:  r.amount,
      dueDate: r.dueDate,
      status:  r.status,
      paidAt:  r.paidAt || null,
      reference: r.reference || null,
    }));

    return ok(res, S.OK, {
      institutions: { total: instTotal, active: instActive, suspended: instSuspended },
      totals:       { students: studentTotal, teachers: teacherTotal },
      revenue: {
        rentCollectedThisMonth: rent.collectedThisMonth,
        rentOverdue:            rent.overdue,
        feeCollectedThisMonth:  fee.collected,
      },
      recentChanges,
      overdueRents,
    });
  } catch (err) {
    next(err);
  }
};
