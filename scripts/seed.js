'use strict';
// scripts/seed.js — initial data seed
// Run from repo root:  node scripts/seed.js   (or: npm run seed)
//
// Creates (idempotent — safe to re-run; re-running resets the demo passwords):
//   1. Operator superadmin (with TOTP 2FA secret → printed for authenticator setup)
//   2. One demo institution (mode: autonomous, status: active, slug: demo-school)
//   3. The owner teacher (isOwner, panelAccess: ['teacher','admin'])
//      → ONE credential opens BOTH the admin panel (by email) and teacher panel (by mobile)
//   4. The institution's instrument master list

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'api', '.env') });

const db = require('../apps/api/src/config/db');
const { hash } = require('../apps/api/src/config/password');
const totp = require('../apps/api/src/config/totp');

const Operator = require('../apps/api/src/models/Operator');
const Institution = require('../apps/api/src/models/Institution');
const Teacher = require('../apps/api/src/models/Teacher');
const Instrument = require('../apps/api/src/models/Instrument');
const DayPattern = require('../apps/api/src/models/DayPattern');
const TimeSlot = require('../apps/api/src/models/TimeSlot');
const Batch = require('../apps/api/src/models/Batch');
const Student = require('../apps/api/src/models/Student');
const Attendance = require('../apps/api/src/models/Attendance');
const ClassSession = require('../apps/api/src/models/ClassSession');

// ── Demo credentials (dev only) ──────────────────────────────────────────────
const OPERATOR = { name: 'Super Admin', email: 'superadmin@maxmusic.internal', password: 'Operator@123' };
const INSTITUTION = { slug: 'demo-school', name: 'Demo Music School', contactEmail: 'owner@demo-school.com' };
const OWNER = {
  displayId: 'TCH-001',
  name: 'Demo Owner Teacher',
  email: 'owner@demo-school.com',
  mobile: '9000000001',
  password: 'Teacher@123',
};
const INSTRUMENTS = ['Guitar', 'Keyboard', 'Violin', 'Tabla', 'Sitar', 'Flute', 'Vocals', 'Drums'];

// ── Teaching-data helpers ────────────────────────────────────────────────────
const WEEK_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function todayStart() { return new Date(new Date().toISOString().slice(0, 10)); }

function scheduledDatesInWindow(days, windowDays) {
  const today = todayStart();
  const want = new Set(days.map((d) => DOW[d]));
  const out = [];
  for (let i = windowDays; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (want.has(d.getDay())) out.push(new Date(d));
  }
  return out;
}

async function ensureDayPattern(inst, days) {
  const dayKey = [...days].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)).join('-');
  let dp = await DayPattern.findOne({ institutionId: inst, dayKey });
  if (!dp) dp = await DayPattern.create({ institutionId: inst, days });
  return dp;
}

async function ensureTimeSlot(inst, startTime, endTime) {
  let ts = await TimeSlot.findOne({ institutionId: inst, startTime, endTime });
  if (!ts) ts = await TimeSlot.create({ institutionId: inst, startTime, endTime });
  return ts;
}

async function ensureStaffTeacher(inst, info, passwordHash) {
  let t = await Teacher.findOne({ institutionId: inst, email: info.email });
  if (!t) {
    t = await Teacher.create({
      institutionId: inst, displayId: info.displayId, name: info.name,
      email: info.email, mobile: info.mobile, isOwner: false,
      panelAccess: ['teacher'], employmentType: 'salary', salaryAmount: 25000,
      passwordHash, status: 'active',
    });
  }
  return t;
}

// Build batches/students/attendance/sessions so the teacher panel has real
// content and the roster shows a spread of KPIs.
async function seedTeaching(institution, owner, teacherHash) {
  const inst = institution._id;
  const instruments = await Instrument.find({ institutionId: inst }).lean();
  const instId = (n) => (instruments.find((i) => i.name === n) || instruments[0])._id;

  const dpMWF = await ensureDayPattern(inst, ['mon', 'wed', 'fri']);
  const dpTT  = await ensureDayPattern(inst, ['tue', 'thu']);
  const dpWS  = await ensureDayPattern(inst, ['wed', 'sat']);
  const ts5 = await ensureTimeSlot(inst, '17:00', '18:00');
  const ts6 = await ensureTimeSlot(inst, '18:00', '19:00');
  const ts7 = await ensureTimeSlot(inst, '19:00', '20:00');

  const staff = [
    await ensureStaffTeacher(inst, { displayId: 'TCH-002', name: 'Nirmal Rana',    email: 'nirmal.rana@demo-school.com',    mobile: '9000000002' }, teacherHash),
    await ensureStaffTeacher(inst, { displayId: 'TCH-003', name: 'Jyoti Gothwal',  email: 'jyoti.gothwal@demo-school.com',  mobile: '9000000003' }, teacherHash),
    await ensureStaffTeacher(inst, { displayId: 'TCH-004', name: 'Kalpesh Rawal',  email: 'kalpesh.rawal@demo-school.com',  mobile: '9000000004' }, teacherHash),
  ];

  // teacher → diligence (attendance/session completeness) + active-student ratio
  const plan = [
    { teacher: owner,    diligence: 0.95, active: 0.9, batches: [['Guitar', dpMWF, ts7], ['Keyboard', dpTT, ts5]] },
    { teacher: staff[0], diligence: 0.80, active: 0.8, batches: [['Tabla', dpMWF, ts5], ['Flute', dpWS, ts6]] },
    { teacher: staff[1], diligence: 0.65, active: 0.6, batches: [['Violin', dpTT, ts6]] },
    { teacher: staff[2], diligence: 0.40, active: 0.5, batches: [['Drums', dpWS, ts7]] },
  ];

  const vEnd = new Date(); vEnd.setDate(vEnd.getDate() + 60);
  let seq = 0;

  for (const p of plan) {
    for (const [instr, dp, ts] of p.batches) {
      const name = `${instr.slice(0, 3).toUpperCase()}-${dp.dayKey.toUpperCase()}-${ts.startTime}`;
      let batch = await Batch.findOne({ institutionId: inst, name });
      if (!batch) {
        batch = await Batch.create({
          institutionId: inst, name, instrumentId: instId(instr),
          dayPatternId: dp._id, timeSlotId: ts._id, teacherId: p.teacher._id, status: 'active',
        });
      }

      const N = 5;
      const studentIds = [];
      for (let i = 0; i < N; i++) {
        seq++;
        const mobile = `9811${String(100000 + seq).slice(-6)}`;
        const isActive = i / N < p.active;
        let s = await Student.findOne({ institutionId: inst, mobile });
        if (!s) {
          s = await Student.create({
            institutionId: inst, displayId: `STU-${1000 + seq}`,
            name: `${instr} Student ${seq}`, mobile,
            teacherId: p.teacher._id, batchId: batch._id,
            joinStatus: isActive ? 'active' : 'trial',
            category: isActive ? 'regular' : 'trial',
            validityStart: new Date(), validityEnd: vEnd, validityDays: 60,
            paidClasses: 12, passwordHash: teacherHash, status: 'active',
          });
        }
        studentIds.push(s._id);
      }
      await Batch.updateOne({ _id: batch._id }, { $set: { studentCount: studentIds.length } });

      // Attendance + sessions on the most-recent `diligence` share of the
      // batch's scheduled class-days in the last 30 days.
      const dates = scheduledDatesInWindow(dp.days, 30);
      const recent = dates.slice(-Math.round(dates.length * p.diligence));
      for (const d of recent) {
        for (const sid of studentIds) {
          await Attendance.updateOne(
            { studentId: sid, batchId: batch._id, date: d },
            { $set: { institutionId: inst, teacherId: p.teacher._id, status: 'present', markedBy: { actorId: String(p.teacher._id), actorRole: 'teacher' } } },
            { upsert: true }
          );
        }
        await ClassSession.updateOne(
          { institutionId: inst, batchId: batch._id, targetDate: d },
          { $setOnInsert: {
            institutionId: inst, batchId: batch._id, teacherId: p.teacher._id,
            meetingUrl: `https://zoom.us/j/${90000000 + (Math.floor(d.getTime() / 86400000) % 9000000)}`,
            targetDate: d, launchedBy: { actorId: String(p.teacher._id), actorRole: 'teacher' },
          } },
          { upsert: true }
        );
      }
    }
  }
  console.log('[seed] ✓ teaching data (4 teachers, 6 batches, students, attendance, sessions)');
}

async function main() {
  await db.connect();

  // ── 1. Operator superadmin ──────────────────────────────────────────────────
  let operator = await Operator.findOne({ email: OPERATOR.email }).select('+totpSecret');
  const passwordHash = await hash(OPERATOR.password);
  let totpSecret;
  if (!operator) {
    totpSecret = totp.generateSecret();
    operator = await Operator.create({
      name: OPERATOR.name,
      email: OPERATOR.email,
      passwordHash,
      twoFactorEnabled: true,
      totpSecret,
    });
    console.log('[seed] ✓ created operator');
  } else {
    totpSecret = operator.totpSecret || totp.generateSecret();
    operator.passwordHash = passwordHash;     // reset to known demo password
    operator.totpSecret = totpSecret;
    operator.twoFactorEnabled = true;
    await operator.save();
    console.log('[seed] ✓ updated operator (password reset)');
  }

  // ── 2. Demo institution ─────────────────────────────────────────────────────
  let institution = await Institution.findOne({ slug: INSTITUTION.slug });
  if (!institution) {
    institution = await Institution.create({
      name: INSTITUTION.name,
      slug: INSTITUTION.slug,
      mode: 'autonomous',            // owner gets BOTH panels
      status: 'active',
      createdByOperatorId: operator._id,
      contactEmail: INSTITUTION.contactEmail,
      branding: {
        schoolName: INSTITUTION.name,
        primaryColor: '#5B8DEF',
        tagline: 'Learn. Play. Perform.',
      },
      rent: { amount: 5000, billingCycle: 'monthly' },
      activatedAt: new Date(),
    });
    console.log('[seed] ✓ created institution');
  } else {
    institution.status = 'active';
    await institution.save();
    console.log('[seed] ✓ institution already exists');
  }

  // ── 3. Owner teacher (single credential → admin + teacher panels) ───────────
  const teacherHash = await hash(OWNER.password);
  let owner = await Teacher.findOne({ institutionId: institution._id, email: OWNER.email });
  if (!owner) {
    owner = await Teacher.create({
      institutionId: institution._id,
      displayId: OWNER.displayId,
      name: OWNER.name,
      email: OWNER.email,
      mobile: OWNER.mobile,
      isOwner: true,
      panelAccess: ['teacher', 'admin'],
      employmentType: 'rent',
      passwordHash: teacherHash,
      status: 'active',
    });
    console.log('[seed] ✓ created owner teacher');
  } else {
    owner.passwordHash = teacherHash;          // reset to known demo password
    owner.panelAccess = ['teacher', 'admin'];
    owner.status = 'active';
    await owner.save();
    console.log('[seed] ✓ updated owner teacher (password reset)');
  }

  // Link owner back onto the institution
  if (String(institution.ownerTeacherId) !== String(owner._id)) {
    institution.ownerTeacherId = owner._id;
    await institution.save();
  }

  // ── 4. Instrument master list for this institution ──────────────────────────
  for (const name of INSTRUMENTS) {
    await Instrument.updateOne(
      { institutionId: institution._id, name },
      { $setOnInsert: { institutionId: institution._id, name, isActive: true } },
      { upsert: true }
    );
  }
  console.log(`[seed] ✓ ${INSTRUMENTS.length} instruments ensured`);

  // ── 5. Teaching data: staff teachers · day patterns · time slots · batches ──
  //      · students · attendance · class sessions (so the teacher panel shows
  //      real batches, a roster, and varied KPIs). Idempotent by natural keys.
  await seedTeaching(institution, owner, teacherHash);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const otpauth = totp.otpauthUrl({ email: operator.email, secret: totpSecret });
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(' SEED COMPLETE — demo credentials');
  console.log('────────────────────────────────────────────────────────────');
  console.log(' OPERATOR (superadmin)   http://localhost:3000');
  console.log(`   email     ${OPERATOR.email}`);
  console.log(`   password  ${OPERATOR.password}`);
  console.log('   2FA: add this secret to Google Authenticator / Authy:');
  console.log(`   secret    ${totpSecret}`);
  console.log(`   otpauth   ${otpauth}`);
  console.log('');
  console.log(` ADMIN panel             http://localhost:3001/${INSTITUTION.slug}/admin/login`);
  console.log(`   email     ${OWNER.email}`);
  console.log(`   password  ${OWNER.password}`);
  console.log('');
  console.log(` TEACHER panel           http://localhost:3002/${INSTITUTION.slug}/teacher/login`);
  console.log(`   mobile    ${OWNER.mobile}`);
  console.log(`   password  ${OWNER.password}`);
  console.log('────────────────────────────────────────────────────────────\n');

  await db.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});
