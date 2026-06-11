'use strict';
// scripts/verify-logins.js — DEV ONLY. Hits the live API on :4000 and verifies
// every panel credential actually authenticates end-to-end.

require('dotenv').config();

const BASE = 'http://localhost:4000';
const SLUG = 'demo-music-academy'; // slug of the seeded "Demo Music School" (changed via slug-request QA)

const OP = { email: 'admin@maxmusic.internal', password: 'Operator@123' };
const ADMIN   = { email: 'teacher@demo.internal', password: 'Teacher@123' };
const TEACHER = { mobile: '9999999999', password: 'Teacher@123' };
const STUDENT = { mobile: '8888888888', password: 'Student@123' };

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function line(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${detail}`);
  return ok;
}

async function main() {
  let allOk = true;

  // 1. OPERATOR — single step (TOTP 2FA removed; email+password OR mobile OTP)
  const o = await post('/api/auth/operator/login', { email: OP.email, password: OP.password });
  const op = o.json && o.json.data && o.json.data.operator;
  allOk &= line('operator login', o.status === 200 && !!op,
    `HTTP ${o.status} → ${op ? op.email + ' (' + op.role + ')' : o.json.message}`);

  // 2. ADMIN — by email
  const a = await post(`/api/inst/${SLUG}/auth/admin/login`, ADMIN);
  const au = a.json && a.json.data && a.json.data.user;
  allOk &= line('admin login', a.status === 200 && !!au,
    `HTTP ${a.status} → ${au ? au.role + ' [' + (au.panelAccess || []).join(',') + ']' : a.json.message}`);

  // 3. TEACHER — by mobile
  const t = await post(`/api/inst/${SLUG}/auth/teacher/login`, TEACHER);
  const tu = t.json && t.json.data && t.json.data.user;
  allOk &= line('teacher login', t.status === 200 && !!tu,
    `HTTP ${t.status} → ${tu ? tu.role : t.json.message}`);

  // 4. STUDENT — by mobile
  const s = await post(`/api/inst/${SLUG}/auth/student/login`, STUDENT);
  const su = s.json && s.json.data && s.json.data.user;
  allOk &= line('student login', s.status === 200 && !!su,
    `HTTP ${s.status} → ${su ? su.role + ' (' + su.displayId + ')' : s.json.message}`);

  console.log('─'.repeat(60));
  console.log(allOk ? 'ALL LOGINS WORKING ✓' : 'SOME LOGINS FAILED ✗');
  process.exit(allOk ? 0 : 1);
}

main().catch(err => { console.error('verify-logins fatal:', err.message || err); process.exit(1); });
