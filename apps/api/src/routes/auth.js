'use strict';

// /api/auth/operator/* — superadmin auth (2-step, 2FA mandatory).
const router = require('express').Router();

const AuthController = require('../controllers/operator/AuthController');
const operatorAuth = require('../middleware/operatorAuth');
const { operatorLoginLimiter } = require('../middleware/rateLimit');

router.post('/operator/login',      operatorLoginLimiter, AuthController.login);
router.post('/operator/verify-2fa', operatorLoginLimiter, AuthController.verify2fa);
router.post('/operator/logout',     AuthController.logout);
router.get('/operator/me',          operatorAuth, AuthController.me);

module.exports = router;
