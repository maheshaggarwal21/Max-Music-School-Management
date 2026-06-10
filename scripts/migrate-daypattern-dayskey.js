'use strict';
// scripts/migrate-daypattern-dayskey.js — one-off migration for BUG-01 (AUDIT.md §6).
//
// The old index { institutionId: 1, days: 1 } { unique: true } was MULTIKEY-unique
// (days is an array) → two patterns sharing any single day collided on E11000.
// The model now derives a scalar `daysKey` ("mon-wed-fri", canonical day order)
// and enforces uniqueness on { institutionId, daysKey } instead.
//
// This script: (1) drops the old multikey unique index if present,
//              (2) backfills daysKey on every existing DayPattern,
//              (3) syncs model indexes so the new unique index is built.
//
//   node scripts/migrate-daypattern-dayskey.js   ← uses repo-root .env

require('dotenv').config();

const path = require('path');
const API = path.join(__dirname, '../apps/api/src');
const { connect, disconnect } = require(path.join(API, 'config/db'));
const DayPattern = require(path.join(API, 'models/DayPattern'));

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const toDaysKey = days => [...days].sort((a, b) => DAY_ENUM.indexOf(a) - DAY_ENUM.indexOf(b)).join('-');

async function main() {
  await connect();
  const coll = DayPattern.collection;

  // 1. Drop the old multikey unique index (name as Mongo auto-derives it).
  const indexes = await coll.indexes();
  const old = indexes.find(ix => ix.key && ix.key.institutionId === 1 && ix.key.days === 1);
  if (old) {
    await coll.dropIndex(old.name);
    console.log(`dropped old index ${old.name}`);
  } else {
    console.log('old { institutionId, days } index not present — nothing to drop');
  }

  // 2. Backfill daysKey on existing documents.
  const docs = await DayPattern.find({ $or: [{ daysKey: { $exists: false } }, { daysKey: null }] }).lean();
  for (const doc of docs) {
    await coll.updateOne({ _id: doc._id }, { $set: { daysKey: toDaysKey(doc.days || []) } });
  }
  console.log(`backfilled daysKey on ${docs.length} pattern(s)`);

  // 3. Build the new unique index from the schema definition.
  await DayPattern.syncIndexes();
  console.log('synced indexes:', (await coll.indexes()).map(ix => ix.name).join(', '));

  await disconnect();
  console.log('done ✓');
}

main().catch(err => { console.error(err); process.exit(1); });
