'use strict';

// /api/operator/* — superadmin god-mode (cross-institution). EVERY route behind operatorAuth.
const router = require('express').Router();

const operatorAuth = require('../middleware/operatorAuth');
const Dashboard   = require('../controllers/operator/DashboardController');
const Institution = require('../controllers/operator/InstitutionController');
const Students    = require('../controllers/operator/StudentsController');
const Teachers    = require('../controllers/operator/TeachersController');
const Payments    = require('../controllers/operator/PaymentsController');
const Changes     = require('../controllers/operator/ChangesController');
const Settings    = require('../controllers/operator/SettingsController');
const SlugRequests = require('../controllers/operator/SlugRequestController');
const Credentials = require('../controllers/operator/CredentialsController');
const { passwordResetLimiter } = require('../middleware/rateLimit');

// Gate the whole namespace.
router.use(operatorAuth);

// Dashboard
router.get('/dashboard', Dashboard.get);

// Institutions — lifecycle
router.get('/institutions',     Institution.list);
router.post('/institutions',    Institution.create);
router.get('/institutions/:id', Institution.get);
router.patch('/institutions/:id', Institution.update);
router.post('/institutions/:id/grant-admin',  Institution.grantAdmin);
router.post('/institutions/:id/revoke-admin', Institution.revokeAdmin);
router.post('/institutions/:id/suspend',      Institution.suspend);
router.post('/institutions/:id/reactivate',   Institution.reactivate);
router.post('/institutions/:id/terminate',    Institution.terminate);
router.post('/institutions/:id/impersonate',  Institution.impersonate);

// Cross-institution collections
router.get('/students',       Students.list);
router.post('/students',      Students.create);   // god-mode enrol into any institution
router.get('/students/:id/catalog', Students.catalog); // institution catalog for the edit form
router.get('/students/:id',   Students.get);
router.patch('/students/:id', Students.update);   // god-mode edit (audited)
router.get('/teachers',       Teachers.list);
router.get('/teachers/:id',   Teachers.get);
router.patch('/teachers/:id', Teachers.update);   // god-mode edit (audited)

// Money
router.get('/payments',                  Payments.listStudentFees);
router.get('/rent-invoices',             Payments.listRentInvoices);
router.post('/rent-invoices/:id/mark-paid', Payments.markRentPaid);

// Slug change requests (filed by institution admins)
router.get('/slug-requests',              SlugRequests.list);
router.post('/slug-requests/:id/approve', SlugRequests.approve);
router.post('/slug-requests/:id/reject',  SlugRequests.reject);

// Credential directory + hierarchical password reset (identifiers only; reset
// requires the operator's own password OR an OTP on his own verified mobile).
router.get('/credentials', Credentials.list);
router.post('/credentials/reset-otp', passwordResetLimiter, Credentials.resetOtpRequest);
router.post('/credentials/:role/:id/reset-password', passwordResetLimiter, Credentials.resetPassword);

// Global audit timeline
router.get('/changes', Changes.list);

// Settings
router.get('/settings',               Settings.getSettings);
router.patch('/settings',             Settings.updateSettings);
// Fail-safe master OTP — superadmin must re-enter his password to change it.
router.patch('/settings/god-otp',     Settings.updateGodOtp);
// Operator mobile for OTP login — set (sends verify code) + verify.
router.post('/settings/mobile',        Settings.setMobile);
router.post('/settings/mobile/verify', Settings.verifyMobile);
router.get('/settings/instruments',   Settings.listInstruments);
router.post('/settings/instruments',  Settings.upsertInstrument);

module.exports = router;
