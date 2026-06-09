'use strict';
// TODO: Phase 4 — /api/inst/:slug/{auth,admin,teacher,student}/*
//                 full middleware chains: resolveInstitution → instAuth(panel) → scopeGuard → [panelGuard] → controller
//                 cookie path-scoped to /api/inst/:slug per slug
const router = require('express').Router();
module.exports = router;
