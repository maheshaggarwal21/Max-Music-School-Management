'use strict';
// TODO: Phase 2 — :slug → Institution doc (in-memory cache, TTL 5 min)
//                 unknown slug → 404 (never confirm existence)
//                 suspended|terminated → 403
//                 sets req.institution
module.exports = (req, res, next) => next();
