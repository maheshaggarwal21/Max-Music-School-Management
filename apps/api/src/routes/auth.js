'use strict';

// /api/auth/operator/* — superadmin auth. Single step, two alternatives:
// email+password OR mobile OTP (TOTP 2FA removed by user decision 2026-06-12).
const router = require('express').Router();

const AuthController = require('../controllers/operator/AuthController');
const operatorAuth = require('../middleware/operatorAuth');
const { operatorLoginLimiter, otpRequestLimiter } = require('../middleware/rateLimit');

router.post('/operator/login',       operatorLoginLimiter, AuthController.login);
router.post('/operator/otp/request', otpRequestLimiter,    AuthController.otpRequest);
router.post('/operator/otp/verify',  operatorLoginLimiter, AuthController.otpVerify);
router.post('/operator/logout',     AuthController.logout);
router.get('/operator/me',          operatorAuth, AuthController.me);

module.exports = router;
