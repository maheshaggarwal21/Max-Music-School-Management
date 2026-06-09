'use strict';
// scripts/seed.js — initial data seed
// Run after deploy: node scripts/seed.js
// Creates: superadmin (with TOTP) + instrument master list + demo institution

require('dotenv').config();

async function main() {
  // TODO: Phase 0-09 — implement:
  // 1. Connect to MongoDB (config/db.js)
  // 2. Create Operator doc (name, email, passwordHash, twoFactorEnabled:true, totpSecret)
  //    → print TOTP QR code URL to console for first-time setup
  // 3. Seed instrument master: Guitar, Keyboard, Violin, Tabla, Sitar, Flute, Vocals, Drums
  // 4. Create one demo institution (mode: managed)
  //    → seed one demo teacher (isOwner: true, panelAccess: ['teacher'])

  console.log('[seed] Not yet implemented — Phase 0-09');
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});
