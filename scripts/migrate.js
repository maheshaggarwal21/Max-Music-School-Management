'use strict';
// scripts/migrate.js — future migrations
require('dotenv').config();

async function main() {
  console.log('[migrate] No migrations to run.');
  process.exit(0);
}

main().catch(err => {
  console.error('[migrate] Fatal:', err);
  process.exit(1);
});
