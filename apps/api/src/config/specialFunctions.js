'use strict';

const UniqueIdCounter = require('../models/UniqueIdCounter');
const Institution = require('../models/Institution');

function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function ensureUniqueSlug(name) {
  const base = generateSlug(name);
  if (!base) throw new Error('Cannot derive slug from name');
  let candidate = base;
  let i = 2;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const exists = await Institution.exists({ slug: candidate });
    if (!exists) return candidate;
    candidate = `${base}-${i++}`;
  }
  throw new Error('Could not allocate unique slug');
}

const DEFAULT_STARTS = { student: 106000, teacher: 100000 };

async function nextDisplayId(institutionId, entityType) {
  if (!institutionId) throw new Error('institutionId required');
  if (!DEFAULT_STARTS[entityType]) throw new Error(`Unknown entityType: ${entityType}`);

  const start = DEFAULT_STARTS[entityType];

  const counter = await UniqueIdCounter.findOneAndUpdate(
    { institutionId, entityType },
    { $inc: { seq: 1 }, $setOnInsert: { start } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return String(start + counter.seq);
}

function abbreviateDays(days) {
  const map = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' };
  if (!Array.isArray(days)) return '';
  return days.map(d => map[d] || '').join('');
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return '';
  return `${startTime} - ${endTime}`;
}

function encodeBatchName({ instrumentName, startTime, endTime, days, mode }) {
  const time = formatTimeRange(startTime, endTime);
  const dayAbbr = abbreviateDays(days);
  const modeFlag = (mode === 'online' || !mode) ? 'ON' : 'OFF';
  const parts = [];
  if (instrumentName) parts.push(instrumentName);
  if (time) parts.push(time);
  if (dayAbbr) parts.push(`(${dayAbbr})`);
  parts.push(modeFlag);
  return parts.join(' ');
}

module.exports = {
  generateSlug,
  ensureUniqueSlug,
  nextDisplayId,
  abbreviateDays,
  formatTimeRange,
  encodeBatchName,
};
