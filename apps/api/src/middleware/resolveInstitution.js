'use strict';

const Institution = require('../models/Institution');
const { notFound, forbidden } = require('../config/helper');
const S = require('../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// resolveInstitution — :slug → req.institution.
// In-memory TTL cache (5 min) keyed by slug. Cache holds the lean doc; any
// suspend / mode toggle / branding update must call invalidateInstitution(slug)
// to bust the entry.
// Behaviour:
//   - unknown slug   → 404 (NEVER confirm existence)
//   - terminated     → 404 (treated as if it never existed)
//   - suspended      → 403 with neutral message
//   - active|pending → req.institution set; next()
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // slug → { doc, expiresAt }

function getCached(slug) {
  const e = cache.get(slug);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    cache.delete(slug);
    return null;
  }
  return e.doc;
}

function setCached(slug, doc) {
  cache.set(slug, { doc, expiresAt: Date.now() + TTL_MS });
}

function invalidateInstitution(slug) {
  if (slug) cache.delete(slug);
}

function clearAll() {
  cache.clear();
}

module.exports = async function resolveInstitution(req, res, next) {
  try {
    const slug = req.params.slug;
    if (!slug) return notFound(res, S.NOT_FOUND);

    let doc = getCached(slug);
    if (!doc) {
      doc = await Institution.findOne({ slug }).lean();
      if (doc) setCached(slug, doc);
    }

    if (!doc || doc.status === 'terminated') {
      return notFound(res, S.NOT_FOUND);
    }

    if (doc.status === 'suspended') {
      return forbidden(res, S.AUTH_INSTITUTION_SUSPENDED);
    }

    req.institution = doc;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports.invalidateInstitution = invalidateInstitution;
module.exports.clearAll = clearAll;
