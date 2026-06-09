'use strict';

const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────────────────────
// Password hashing. bcrypt, cost 12. The only place that knows the cost factor.
// ─────────────────────────────────────────────────────────────────────────────

const ROUNDS = 12;

async function hash(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

async function compare(plain, hashed) {
  if (!plain || !hashed) return false;
  try {
    return await bcrypt.compare(String(plain), hashed);
  } catch {
    return false;
  }
}

// Random URL-safe temporary password for inline-created accounts whose real
// credential is delivered out of band (Phase 7 email). Returns the plaintext —
// caller is responsible for surfacing it exactly once, never persisting it.
function randomTempPassword(len = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  // crypto.randomBytes avoids Math.random; ok in runtime (not a workflow script).
  const bytes = require('crypto').randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

module.exports = { hash, compare, randomTempPassword };
