'use strict';
// TODO: Phase 4 — manual fee entry (creates Payment + updates Student.paidAmount)
//                 reconciliation feed (list RazorpayWebhookEvent filtered by institutionId, matched/unmatched)
exports.createPayment = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
exports.reconciliationFeed = (req, res) => res.status(501).json({ success: false, message: 'Not implemented' });
