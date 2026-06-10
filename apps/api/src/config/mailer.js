'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — Nodemailer with a per-institution branded sender.
// WHITE-LABEL: the From display name is ALWAYS the institution's school name,
// NEVER "Max Music School". Emails carry no operator brand/domain.
// Fails SOFT: if SMTP is unconfigured or a send errors, it logs and returns a
// null result instead of throwing — a mail failure must never break a controller.
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

// Build the From header. The visible name is the institution's branding — the
// student never sees the operator. The envelope address is the shared SMTP user.
function senderFor(institution) {
  const name =
    (institution && institution.branding && institution.branding.schoolName) ||
    (institution && institution.name) ||
    'Music School';
  const safe = String(name).replace(/"/g, '');
  return `"${safe}" <${process.env.SMTP_USER}>`;
}

async function sendMail({ to, subject, html, text, institution }) {
  const tx = getTransporter();
  if (!tx) {
    console.warn('[mailer] SMTP not configured — skipping send to', to);
    return { messageId: null, accepted: [] };
  }
  if (!to) {
    console.warn('[mailer] no recipient — skipping send');
    return { messageId: null, accepted: [] };
  }
  try {
    const info = await tx.sendMail({ from: senderFor(institution), to, subject, html, text });
    return { messageId: info.messageId, accepted: info.accepted || [] };
  } catch (err) {
    console.error('[mailer] send failed', err.message);
    return { messageId: null, accepted: [], error: err.message };
  }
}

module.exports = { sendMail, senderFor };
