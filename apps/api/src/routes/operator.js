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
router.get('/students',     Students.list);
router.get('/students/:id', Students.get);
router.get('/teachers',     Teachers.list);
router.get('/teachers/:id', Teachers.get);

// Money
router.get('/payments',                  Payments.listStudentFees);
router.get('/rent-invoices',             Payments.listRentInvoices);
router.post('/rent-invoices/:id/mark-paid', Payments.markRentPaid);

// Global audit timeline
router.get('/changes', Changes.list);

// Settings
router.get('/settings',              Settings.getProfile);
router.patch('/settings',            Settings.updateProfile);
router.post('/settings/2fa',         Settings.toggle2fa);
router.get('/settings/instruments',  Settings.listInstruments);
router.post('/settings/instruments', Settings.upsertInstrument);

module.exports = router;
