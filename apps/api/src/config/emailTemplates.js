'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML templates. WHITE-LABEL: every visible string uses the institution's
// branding.schoolName — never "Max Music School".
// Templates are intentionally simple (inline CSS) for email-client compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_STYLE = `
  body{margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f5;color:#18181b;}
  .wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;}
  .header{padding:24px 32px;background:#18181b;}
  .header h1{margin:0;font-size:20px;color:#fff;font-weight:700;}
  .body{padding:28px 32px;}
  .body p{margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3f46;}
  .cred-box{margin:20px 0;padding:16px 20px;background:#f4f4f5;border-radius:8px;border:1px solid #e4e4e7;}
  .cred-box p{margin:4px 0;font-size:14px;color:#52525b;}
  .cred-box strong{color:#18181b;}
  .cred-box .password{font-size:18px;letter-spacing:2px;font-weight:700;color:#18181b;font-family:monospace;}
  .note{margin:18px 0 0;font-size:13px;color:#71717a;}
  .footer{padding:16px 32px;border-top:1px solid #e4e4e7;background:#fafafa;}
  .footer p{margin:0;font-size:12px;color:#a1a1aa;text-align:center;}
`.trim();

function wrap(schoolName, primaryColor, bodyContent) {
  const hex = primaryColor || '#18181b';
  const style = BASE_STYLE.replace('background:#18181b', `background:${hex}`);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${schoolName}</title>
<style>${style}</style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>${schoolName}</h1></div>
    <div class="body">${bodyContent}</div>
    <div class="footer"><p>This email was sent by ${schoolName}. Please keep your password safe.</p></div>
  </div>
</body>
</html>`;
}

// ── Welcome email for a new teacher (or institution owner) ───────────────────
function teacherWelcome({ schoolName, primaryColor, teacherName, panelUrl, tempPassword }) {
  const body = `
    <p>Hi ${teacherName},</p>
    <p>Welcome to <strong>${schoolName}</strong>! Your teacher account has been created.</p>
    <div class="cred-box">
      <p>Sign in at: <strong>${panelUrl}</strong></p>
      <p>Temporary password: <span class="password">${tempPassword}</span></p>
    </div>
    <p>Please change your password after first login.</p>
    <p class="note">If you did not expect this email, please contact your school administrator.</p>
  `;
  return {
    subject: `Your ${schoolName} teacher account`,
    html: wrap(schoolName, primaryColor, body),
    text: `Hi ${teacherName},\n\nWelcome to ${schoolName}!\nSign in at: ${panelUrl}\nTemporary password: ${tempPassword}\n\nPlease change your password after first login.`,
  };
}

// ── Welcome email for a newly approved student ───────────────────────────────
function studentWelcome({ schoolName, primaryColor, studentName, panelUrl, tempPassword }) {
  const body = `
    <p>Hi ${studentName},</p>
    <p>Great news — your enrollment request at <strong>${schoolName}</strong> has been approved!</p>
    <p>You can now log in to your student portal:</p>
    <div class="cred-box">
      <p>Sign in at: <strong>${panelUrl}</strong></p>
      <p>Temporary password: <span class="password">${tempPassword}</span></p>
    </div>
    <p>Please change your password after your first login.</p>
    <p class="note">If you have any questions, contact your school administrator.</p>
  `;
  return {
    subject: `You're enrolled at ${schoolName}`,
    html: wrap(schoolName, primaryColor, body),
    text: `Hi ${studentName},\n\nYour enrollment at ${schoolName} has been approved!\nSign in at: ${panelUrl}\nTemporary password: ${tempPassword}\n\nPlease change your password after first login.`,
  };
}

// ── Notification when an admin grants admin-panel access to the owner ────────
function grantAdminNotice({ schoolName, primaryColor, teacherName, adminPanelUrl }) {
  const body = `
    <p>Hi ${teacherName},</p>
    <p>You have been granted <strong>admin access</strong> to <strong>${schoolName}</strong>.</p>
    <p>You can now manage your school — students, teachers, batches, payments, and settings — from the admin panel:</p>
    <div class="cred-box">
      <p>Admin panel: <strong>${adminPanelUrl}</strong></p>
    </div>
    <p>Use the same credentials you already have for the teacher panel.</p>
    <p class="note">If you did not expect this change, contact your school administrator.</p>
  `;
  return {
    subject: `Admin access granted — ${schoolName}`,
    html: wrap(schoolName, primaryColor, body),
    text: `Hi ${teacherName},\n\nYou have been granted admin access to ${schoolName}.\nAdmin panel: ${adminPanelUrl}\n\nUse your existing credentials.`,
  };
}

module.exports = { teacherWelcome, studentWelcome, grantAdminNotice };
