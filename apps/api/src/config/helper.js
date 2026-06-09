'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Helper.response(res, statusCode, message, data?)
// Universal envelope: { success, message, data }. NEVER use bare res.json().
// ─────────────────────────────────────────────────────────────────────────────

function response(res, statusCode, message, data = null) {
  const success = statusCode >= 200 && statusCode < 300;
  return res.status(statusCode).json({ success, message, data });
}

function ok(res, message, data)             { return response(res, 200, message, data); }
function created(res, message, data)        { return response(res, 201, message, data); }
function badRequest(res, message, data)     { return response(res, 400, message, data); }
function unauthorized(res, message = 'Authentication required') { return response(res, 401, message); }
function forbidden(res, message = 'Access denied')              { return response(res, 403, message); }
function notFound(res, message = 'Not found')                   { return response(res, 404, message); }
function tooMany(res, message = 'Too many attempts')            { return response(res, 429, message); }
function serverError(res, message = 'Internal server error')    { return response(res, 500, message); }

// Standard pagination payload — items + meta.
function paginated(items, paginationMeta) {
  return {
    items,
    pagination: {
      page:  paginationMeta.page,
      limit: paginationMeta.limit,
      total: paginationMeta.totalDocs,
      pages: paginationMeta.totalPages,
    },
  };
}

// Strip secrets from any object before logging or returning.
const SECRET_FIELDS = new Set([
  'password', 'passwordHash', 'jwt_token', 'token',
  'recoveryOtp', 'otp', 'totpSecret', 'challengeToken',
]);

function stripSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripSecrets);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_FIELDS.has(k)) continue;
    out[k] = (v && typeof v === 'object') ? stripSecrets(v) : v;
  }
  return out;
}

module.exports = {
  response,
  ok, created, badRequest, unauthorized, forbidden, notFound, tooMany, serverError,
  paginated,
  stripSecrets,
  SECRET_FIELDS,
};
