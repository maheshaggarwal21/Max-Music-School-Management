'use strict';
// scripts/verify-otp.js — DEV ONLY. End-to-end smoke of the OTP login feature
// against the live API on :4000 + the dev DB.
//
// The SMS provider in dev only prints codes to the API console, so this script
// cannot read them. Instead, after each /otp/request it overwrites the pending
// LoginOtp's hash with a KNOWN code via the DB — every other part of the flow
// (eligibility, expiry, attempts, consume, cookie issue, audit) runs for real.
//
//   cd apps/api && node ../../scripts/verify-otp.js
//
// Covers: operator single-step password login (2FA gone) · OTP login on all 4
// panels · unverified-mobile refusal · god OTP set (password-confirmed) · god
// OTP login with no pending request · attempt exhaustion · verify-mobile flow.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = path.join(__dirname, '../apps/api/src');
const { connect, disconnect } = require(path.join(API, 'config/db'));
const { hash } = require(path.join(API, 'config/password'));
const LoginOtp = require(path.join(API, 'models/LoginOtp'));
const Student = require(path.join(API, 'models/Student'));

const BASE = 'http://localhost:4000';
const SLUG = 'demo-music-academy'; // slug of the seeded "Demo Music School" (changed via slug-request QA)
const KNOWN = '123456';
const GOD_OTP = '88990011';

const OP = { email: 'admin@maxmusic.internal', password: 'Operator@123', mobile: '9000000001' };
const OWNER_MOBILE = '9999999999';   // teacher + admin panels (panelAccess both)
const STUDENT_MOBILE = '8888888888'; // verified demo student
const UNVERIFIED_STUDENT = '6666666666'; // enrolled student, mobileVerified false

let pass = 0, fail = 0;
function line(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${detail}`);
  ok ? pass++ : fail++;
  return ok;
}

async function req(method, p, body, cookie) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, json, cookie: setCookie.split(';')[0] };
}
const post = (p, b, c) => req('POST', p, b, c);

// Replace the newest pending OTP for this identity with the KNOWN code.
async function plantKnownOtp(filter) {
  const doc = await LoginOtp.findOne({ ...filter, consumedAt: null }).sort({ createdAt: -1 });
  if (!doc) throw new Error(`no pending OTP for ${JSON.stringify(filter)}`);
  doc.otpHash = await hash(KNOWN);
  await doc.save();
}

async function main() {
  await connect();

  // ── 1. Operator password login — SINGLE STEP (2FA removed) ────────────────
  const o1 = await post('/api/auth/operator/login', { email: OP.email, password: OP.password });
  const opCookie = o1.cookie;
  line('operator password login (1-step)', o1.status === 200 && !!(o1.json.data && o1.json.data.operator), `HTTP ${o1.status}`);
  const o2 = await req('GET', '/api/auth/operator/me', null, opCookie);
  line('operator session works (/me)', o2.status === 200, `HTTP ${o2.status}`);
  const o3 = await post('/api/auth/operator/login', { email: OP.email, password: 'WrongPass@1' });
  line('operator wrong password → 401', o3.status === 401, `HTTP ${o3.status}`);

  // ── 2. God OTP management ──────────────────────────────────────────────────
  const g1 = await req('PATCH', '/api/operator/settings/god-otp', { newOtp: GOD_OTP, password: 'WrongPass@1' }, opCookie);
  line('god OTP set w/ wrong password → 401', g1.status === 401, `HTTP ${g1.status}`);
  const g2 = await req('PATCH', '/api/operator/settings/god-otp', { newOtp: '123', password: OP.password }, opCookie);
  line('god OTP bad format (3 digits) → 400', g2.status === 400, `HTTP ${g2.status}`);
  const g3 = await req('PATCH', '/api/operator/settings/god-otp', { newOtp: GOD_OTP, password: OP.password }, opCookie);
  line('god OTP set w/ correct password', g3.status === 200 && g3.json.data && g3.json.data.godOtp && g3.json.data.godOtp.isSet, `HTTP ${g3.status}`);

  // ── 3. Teacher panel OTP login ─────────────────────────────────────────────
  const t1 = await post(`/api/inst/${SLUG}/auth/teacher/otp/request`, { mobile: OWNER_MOBILE });
  line('teacher otp request → generic OK', t1.status === 200, `"${t1.json.message}"`);
  await plantKnownOtp({ panel: 'teacher', mobile: OWNER_MOBILE, purpose: 'login' });
  const t2 = await post(`/api/inst/${SLUG}/auth/teacher/otp/verify`, { mobile: OWNER_MOBILE, otp: KNOWN });
  line('teacher otp verify → login', t2.status === 200 && !!t2.cookie, `HTTP ${t2.status} role=${t2.json.data && t2.json.data.user && t2.json.data.user.role}`);
  const t3 = await req('GET', `/api/inst/${SLUG}/auth/teacher/me`, null, t2.cookie);
  line('teacher OTP session works (/me)', t3.status === 200, `HTTP ${t3.status}`);
  const t4 = await post(`/api/inst/${SLUG}/auth/teacher/otp/verify`, { mobile: OWNER_MOBILE, otp: KNOWN });
  line('same code re-use refused (consumed)', t4.status === 401, `HTTP ${t4.status}`);

  // ── 4. Admin panel OTP login (same teacher, panelAccess admin) ─────────────
  const a1 = await post(`/api/inst/${SLUG}/auth/admin/otp/request`, { mobile: OWNER_MOBILE });
  line('admin otp request → generic OK', a1.status === 200);
  await plantKnownOtp({ panel: 'admin', mobile: OWNER_MOBILE, purpose: 'login' });
  const a2 = await post(`/api/inst/${SLUG}/auth/admin/otp/verify`, { mobile: OWNER_MOBILE, otp: KNOWN });
  line('admin otp verify → login', a2.status === 200 && !!a2.cookie, `role=${a2.json.data && a2.json.data.user && a2.json.data.user.role}`);

  // ── 5. Student panel OTP login ─────────────────────────────────────────────
  const s1 = await post(`/api/inst/${SLUG}/auth/student/otp/request`, { mobile: STUDENT_MOBILE });
  line('student otp request → generic OK', s1.status === 200);
  await plantKnownOtp({ panel: 'student', mobile: STUDENT_MOBILE, purpose: 'login' });
  const s2 = await post(`/api/inst/${SLUG}/auth/student/otp/verify`, { mobile: STUDENT_MOBILE, otp: KNOWN });
  line('student otp verify → login', s2.status === 200 && !!s2.cookie, `HTTP ${s2.status}`);

  // ── 6. Unverified mobile: generic request, refused verify (even god OTP) ───
  await Student.updateOne({ mobile: UNVERIFIED_STUDENT }, { $set: { mobileVerified: false } });
  const u1 = await post(`/api/inst/${SLUG}/auth/student/otp/request`, { mobile: UNVERIFIED_STUDENT });
  line('unverified mobile request → generic OK', u1.status === 200, `(no OTP actually issued)`);
  const u1b = await LoginOtp.findOne({ panel: 'student', mobile: UNVERIFIED_STUDENT, purpose: 'login', consumedAt: null });
  line('…and NO OTP row was created', !u1b);
  const u2 = await post(`/api/inst/${SLUG}/auth/student/otp/verify`, { mobile: UNVERIFIED_STUDENT, otp: GOD_OTP });
  line('unverified + god OTP still refused → 401', u2.status === 401, `HTTP ${u2.status}`);

  // ── 7. God OTP login with NO pending request (SMS-outage failsafe) ─────────
  await LoginOtp.deleteMany({ panel: 'teacher', mobile: OWNER_MOBILE, purpose: 'login' });
  const f1 = await post(`/api/inst/${SLUG}/auth/teacher/otp/verify`, { mobile: OWNER_MOBILE, otp: GOD_OTP });
  line('god OTP login, no pending request', f1.status === 200 && !!f1.cookie, `HTTP ${f1.status}`);
  const f2 = await post(`/api/inst/${SLUG}/auth/teacher/otp/verify`, { mobile: OWNER_MOBILE, otp: '00000000' });
  line('wrong god OTP refused → 401', f2.status === 401, `HTTP ${f2.status}`);

  // ── 8. Attempt exhaustion (5 wrong → correct code dead) ────────────────────
  await post(`/api/inst/${SLUG}/auth/student/otp/request`, { mobile: STUDENT_MOBILE });
  await plantKnownOtp({ panel: 'student', mobile: STUDENT_MOBILE, purpose: 'login' });
  for (let i = 0; i < 5; i++) {
    await post(`/api/inst/${SLUG}/auth/student/otp/verify`, { mobile: STUDENT_MOBILE, otp: '999999' });
  }
  const x1 = await post(`/api/inst/${SLUG}/auth/student/otp/verify`, { mobile: STUDENT_MOBILE, otp: KNOWN });
  line('correct code dead after 5 wrong tries', x1.status === 401, `HTTP ${x1.status}`);

  // ── 9. Verify-mobile flow (logged-in student proves their number) ──────────
  const v0 = await post(`/api/inst/${SLUG}/auth/student/login`, { mobile: UNVERIFIED_STUDENT, password: 'Student@123' });
  line('unverified student password login OK', v0.status === 200 && !!v0.cookie, `HTTP ${v0.status}`);
  if (v0.cookie) {
    const v1 = await post(`/api/inst/${SLUG}/student/verify-mobile/request`, {}, v0.cookie);
    line('verify-mobile request', v1.status === 200, `HTTP ${v1.status}`);
    await plantKnownOtp({ panel: 'student', mobile: UNVERIFIED_STUDENT, purpose: 'verify_mobile' });
    const v2 = await post(`/api/inst/${SLUG}/student/verify-mobile/confirm`, { otp: KNOWN }, v0.cookie);
    line('verify-mobile confirm → verified', v2.status === 200 && v2.json.data && v2.json.data.mobileVerified === true, `HTTP ${v2.status}`);
    // Now OTP login must work for this number.
    await post(`/api/inst/${SLUG}/auth/student/otp/request`, { mobile: UNVERIFIED_STUDENT });
    await plantKnownOtp({ panel: 'student', mobile: UNVERIFIED_STUDENT, purpose: 'login' });
    const v3 = await post(`/api/inst/${SLUG}/auth/student/otp/verify`, { mobile: UNVERIFIED_STUDENT, otp: KNOWN });
    line('OTP login works after verification', v3.status === 200, `HTTP ${v3.status}`);
  }

  // ── 10. Operator OTP login (single step) ───────────────────────────────────
  const p1 = await post('/api/auth/operator/otp/request', { mobile: OP.mobile });
  line('operator otp request → generic OK', p1.status === 200);
  await plantKnownOtp({ panel: 'operator', mobile: OP.mobile, purpose: 'login' });
  const p2 = await post('/api/auth/operator/otp/verify', { mobile: OP.mobile, otp: KNOWN });
  line('operator otp verify → session (no 2FA)', p2.status === 200 && !!p2.cookie, `HTTP ${p2.status}`);
  const p3 = await req('GET', '/api/auth/operator/me', null, p2.cookie);
  line('operator OTP session works (/me)', p3.status === 200, `HTTP ${p3.status}`);

  console.log('─'.repeat(72));
  console.log(`${pass} passed, ${fail} failed ${fail === 0 ? '— ALL OTP FLOWS WORKING ✓' : '✗'}`);
  await disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error('verify-otp fatal:', err.message || err); process.exit(1); });
