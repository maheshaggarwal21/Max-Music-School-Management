'use strict';
// TODO: Phase 2 — login throttle (express-rate-limit per IP)
//                 cookie path scoped to /api/inst/:slug so institution A's cookie never reaches B
module.exports = {
  loginLimiter: (req, res, next) => next(),
};
