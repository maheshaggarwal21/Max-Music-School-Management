'use strict';
// scripts/dev-credentials.js — DEV ONLY.
// Sets KNOWN passwords on the seeded demo accounts so the platform can be
// logged into for local QA, grants the owner-teacher admin access (so one
// credential opens both the teacher and admin panels — the PBAC model), and
// ensures one active demo student exists for the student panel.
//
//   node scripts/dev-credentials.js   ← uses repo-root .env
//
// Prints every working credential at the end.

require('dotenv').config();

const path = require('path');
const API = path.join(__dirname, '../apps/api/src');
const { connect, disconnect } = require(path.join(API, 'config/db'));
const { hash } = require(path.join(API, 'config/password'));
const { nextDisplayId } = require(path.join(API, 'config/specialFunctions'));

const Operator    = require(path.join(API, 'models/Operator'));
const Institution = require(path.join(API, 'models/Institution'));
const Teacher     = require(path.join(API, 'models/Teacher'));
const Student     = require(path.join(API, 'models/Student'));

// ── Known dev passwords ──────────────────────────────────────────────────────
const PW = {
  operator: 'Operator@123',
  teacher:  'Teacher@123',   // owner teacher — opens BOTH teacher + admin panels
  student:  'Student@123',
};

const OPERATOR_EMAIL = process.env.SEED_OPERATOR_EMAIL || 'admin@maxmusic.internal';
const DEMO_INST_NAME = process.env.SEED_DEMO_INST || 'Demo Music School';
const STUDENT_MOBILE = '8888888888';

function hr() { console.log('─'.repeat(64)); }

async function main() {
  await connect();

  // 1. Operator — reset password (single-step login; TOTP 2FA removed).
  const operator = await Operator.findOne({ email: OPERATOR_EMAIL });
  if (!operator) throw new Error(`Operator ${OPERATOR_EMAIL} not found — run seed first.`);
  operator.passwordHash = await hash(PW.operator);
  // Dev mobile pre-verified so operator OTP login is testable locally.
  operator.mobile = operator.mobile || '9000000001';
  operator.mobileVerified = true;
  await operator.save();

  // 2. Institution + owner teacher.
  const inst = await Institution.findOne({ name: DEMO_INST_NAME });
  if (!inst) throw new Error(`Institution "${DEMO_INST_NAME}" not found — run seed first.`);

  const owner = await Teacher.findOne({ institutionId: inst._id, isOwner: true });
  if (!owner) throw new Error('Owner teacher not found — run seed first.');
  owner.passwordHash = await hash(PW.teacher);
  owner.panelAccess  = ['teacher', 'admin']; // grant admin so admin panel works
  owner.status       = 'active';
  owner.mobileVerified = true;               // dev: pre-verified for OTP login QA
  await owner.save();

  // 3. Demo student — upsert one active student for the student panel.
  let student = await Student.findOne({ institutionId: inst._id, mobile: STUDENT_MOBILE });
  if (!student) {
    const displayId = await nextDisplayId(inst._id, 'student');
    student = new Student({
      institutionId: inst._id,
      displayId,
      name:          'Demo Student',
      mobile:        STUDENT_MOBILE,
      joinStatus:    'active',
      status:        'active',
      category:      'regular',
    });
  }
  student.passwordHash = await hash(PW.student);
  student.status       = 'active';
  student.joinStatus   = 'active';
  student.mobileVerified = true;             // dev: pre-verified for OTP login QA
  await student.save();

  hr();
  console.log('DEV CREDENTIALS — all set & ready:');
  hr();
  console.log('Institution slug :', inst.slug);
  console.log('');
  console.log('OPERATOR (panel :3000)  — email+password OR mobile OTP');
  console.log('  email      :', OPERATOR_EMAIL);
  console.log('  password   :', PW.operator);
  console.log('  mobile     :', operator.mobile, '(verified — OTP login enabled)');
  console.log('');
  console.log('ADMIN (panel :3001)  — login by EMAIL');
  console.log('  email      :', owner.email);
  console.log('  password   :', PW.teacher);
  console.log('');
  console.log('TEACHER (panel :3002) — login by MOBILE');
  console.log('  mobile     :', owner.mobile);
  console.log('  password   :', PW.teacher);
  console.log('');
  console.log('STUDENT (panel :3003) — login by MOBILE');
  console.log('  mobile     :', student.mobile);
  console.log('  password   :', PW.student);
  console.log('  displayId  :', student.displayId);
  hr();

  await disconnect();
  process.exit(0);
}

main().catch(err => { console.error('[dev-credentials] Fatal:', err.message || err); process.exit(1); });
