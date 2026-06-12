'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for a student's derived payment state. paymentStatus is
// NEVER trusted from the client — every write path (student create/patch, request
// approve, payment record, operator create/update) recomputes it through here so
// it can never drift. All amounts are in PAISE.
//   unpaid  — a fee is owed but nothing paid yet
//   partial — some paid, but less than the total
//   paid    — paid in full (overpay also resolves to paid)
//   free    — no fee assigned (feeTotal <= 0) or admin explicitly marked free
// The trial→active_soon→active→inactive lifecycle (cron-driven) is INDEPENDENT.
// ─────────────────────────────────────────────────────────────────────────────

function derivePaymentStatus(feeTotal, paidAmount, { forceFree } = {}) {
  const total = Number(feeTotal) || 0;
  const paid  = Number(paidAmount) || 0;
  if (forceFree) return 'free';
  if (total <= 0) return 'free';
  if (paid <= 0) return 'unpaid';
  if (paid < total) return 'partial';
  return 'paid';
}

// Outstanding balance — derived in serializers only, never stored.
function remainingAmount(feeTotal, paidAmount) {
  return Math.max(0, (Number(feeTotal) || 0) - (Number(paidAmount) || 0));
}

const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'free'];

module.exports = { derivePaymentStatus, remainingAmount, PAYMENT_STATUSES };
