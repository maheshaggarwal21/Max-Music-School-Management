'use strict';
// scripts/seed.js — initial data seed for a fresh deployment.
//
// Usage:
//   NODE_ENV=production node scripts/seed.js
//   node scripts/seed.js                    ← uses .env in repo root
//
// What it creates:
//   1. Superadmin (Operator) — prints TOTP QR URL + temp password to console.
//   2. Instrument master list (idempotent upserts).
//   3. One demo institution ("Demo Music School", managed mode).
//   4. One demo owner teacher for the demo institution.
//
// Re-running is safe: existing docs are detected and skipped.

require('dotenv').config();

const path = require('path');

// Models live in apps/api — require them from repo root.
const API = path.join(__dirname, '../apps/api/src');
const { connect, disconnect } = require(path.join(API, 'config/db'));
const { hash, randomTempPassword } = require(path.join(API, 'config/password'));
const { generateSecret, qrDataUrl, otpauthUrl } = require(path.join(API, 'config/totp'));
const { ensureUniqueSlug, nextDisplayId } = require(path.join(API, 'config/specialFunctions'));

const Operator    = require(path.join(API, 'models/Operator'));
const Institution = require(path.join(API, 'models/Institution'));
const Teacher     = require(path.join(API, 'models/Teacher'));
const Instrument  = require(path.join(API, 'models/Instrument'));

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const OPERATOR_EMAIL = process.env.SEED_OPERATOR_EMAIL || 'admin@maxmusic.internal';
const OPERATOR_NAME  = process.env.SEED_OPERATOR_NAME  || 'Super Admin';

const INSTRUMENTS = [
  'Guitar', 'Keyboard', 'Violin', 'Tabla', 'Sitar', 'Flute', 'Vocals', 'Drums',
];

const DEMO_INST_NAME = process.env.SEED_DEMO_INST   || 'Demo Music School';
const DEMO_OWNER     = {
  name:   process.env.SEED_DEMO_TEACHER_NAME   || 'Demo Teacher',
  mobile: process.env.SEED_DEMO_TEACHER_MOBILE || '9999999999',
  email:  process.env.SEED_DEMO_TEACHER_EMAIL  || 'teacher@demo.internal',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function hr() { console.log('─'.repeat(60)); }

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Superadmin
// ─────────────────────────────────────────────────────────────────────────────
async function seedOperator() {
  const existing = await Operator.findOne({ email: OPERATOR_EMAIL }).lean();
  if (existing) {
    console.log('[operator] already exists:', OPERATOR_EMAIL);
    return;
  }

  const tempPassword = randomTempPassword();
  const passwordHash = await hash(tempPassword);
  const totpSecret   = generateSecret();

  await Operator.create({
    name:             OPERATOR_NAME,
    email:            OPERATOR_EMAIL,
    passwordHash,
    twoFactorEnabled: false,
    totpSecret,
    tokenVersion:     0,
  });

  const qrUri  = otpauthUrl({ email: OPERATOR_EMAIL, secret: totpSecret });
  let qrImg = '';
  try { qrImg = await qrDataUrl({ email: OPERATOR_EMAIL, secret: totpSecret }); } catch { /* ok */ }

  hr();
  console.log('[operator] CREATED — save these credentials NOW:');
  console.log('  Email:           ', OPERATOR_EMAIL);
  console.log('  Temp password:   ', tempPassword);
  console.log('  TOTP secret:     ', totpSecret);
  console.log('  TOTP QR URI:     ', qrUri);
  if (qrImg) console.log('  TOTP QR data-URL: (copy the line below into a browser to scan)');
  if (qrImg) console.log(' ', qrImg.slice(0, 80) + '…');
  console.log('  → After first login, enrol TOTP via operator Settings → 2FA.');
  hr();
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Instruments (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
async function seedInstruments() {
  let created = 0;
  for (const name of INSTRUMENTS) {
    // Instruments are operator-level (no institutionId) — unique by name.
    const exists = await Instrument.exists({ name });
    if (!exists) {
      await Instrument.create({ name });
      created++;
    }
  }
  console.log(`[instruments] ${created} created, ${INSTRUMENTS.length - created} already exist`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 + 4 — Demo institution + owner teacher
// ─────────────────────────────────────────────────────────────────────────────
async function seedDemoInstitution() {
  const existing = await Institution.findOne({ name: DEMO_INST_NAME }).lean();
  if (existing) {
    console.log('[demo] institution already exists:', DEMO_INST_NAME, '/', existing.slug);
    return;
  }

  const slug = await ensureUniqueSlug(DEMO_INST_NAME);

  const institution = await Institution.create({
    name:               DEMO_INST_NAME,
    slug,
    mode:               'managed',
    status:             'active',
    contactEmail:       DEMO_OWNER.email,
    branding: {
      schoolName:   DEMO_INST_NAME,
      primaryColor: '#5B8DEF',
    },
  });

  const tempPassword = randomTempPassword();
  const passwordHash = await hash(tempPassword);
  const displayId    = await nextDisplayId(institution._id, 'teacher');

  const teacher = await Teacher.create({
    institutionId: institution._id,
    displayId,
    name:          DEMO_OWNER.name,
    mobile:        DEMO_OWNER.mobile,
    email:         DEMO_OWNER.email,
    isOwner:       true,
    panelAccess:   ['teacher'],
    employmentType:'salary',
    passwordHash,
    status:        'active',
  });

  institution.ownerTeacherId = teacher._id;
  await institution.save();

  hr();
  console.log('[demo] institution created:', DEMO_INST_NAME);
  console.log('  Slug:            ', slug);
  console.log('  Teacher login:   ', DEMO_OWNER.email, '/', DEMO_OWNER.mobile);
  console.log('  Temp password:   ', tempPassword);
  console.log('  Panel URL:       ', `/<PLATFORM_DOMAIN>/${slug}/teacher`);
  hr();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[seed] connecting…');
  await connect();

  await seedOperator();
  await seedInstruments();
  await seedDemoInstitution();

  console.log('[seed] done');
  await disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal:', err.message || err);
  process.exit(1);
});
