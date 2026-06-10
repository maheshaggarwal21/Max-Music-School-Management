'use strict';
// One-off migration: DayPattern uniqueness was a MULTIKEY unique index on the
// `days` array (forbade two patterns sharing any single day). Move it to the
// canonical scalar `dayKey`. Steps: backfill dayKey, drop stale index, build new.
require('dotenv').config();
const mongoose = require('mongoose');
const DayPattern = require('../src/models/DayPattern');

const DAY_ENUM = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const coll = DayPattern.collection;

  // 1. Backfill dayKey for every existing doc (canonical week order).
  const docs = await coll.find({}).toArray();
  for (const d of docs) {
    const ordered = [...(d.days || [])].sort((a, b) => DAY_ENUM.indexOf(a) - DAY_ENUM.indexOf(b));
    await coll.updateOne({ _id: d._id }, { $set: { dayKey: ordered.join('-') } });
  }
  console.log(`backfilled dayKey on ${docs.length} day patterns`);

  // 2. Drop the stale multikey unique index if it exists.
  const idx = await coll.indexes();
  for (const i of idx) {
    if (i.name === 'institutionId_1_days_1') {
      await coll.dropIndex(i.name);
      console.log('dropped stale index', i.name);
    }
  }

  // 3. Build the indexes defined on the current schema (incl. dayKey unique).
  await DayPattern.syncIndexes();
  console.log('synced indexes:', (await coll.indexes()).map(i => i.name).join(', '));

  await mongoose.disconnect();
  console.log('done');
})().catch(err => { console.error(err); process.exit(1); });
