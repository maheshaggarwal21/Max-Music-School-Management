'use strict';

// /api/inst/:slug/* — institution panels (admin / teacher / student).
// Full middleware chains (ARCHITECTURE.md):
//   admin:   resolveInstitution → instAuth('admin')   → scopeGuard → panelGuard('admin') → controller
//   teacher: resolveInstitution → instAuth('teacher') → scopeGuard → controller
//   student: resolveInstitution → instAuth('student') → scopeGuard → controller
// Auth/login routes run resolveInstitution only (they establish the session).
const router = require('express').Router();

const resolveInstitution = require('../middleware/resolveInstitution');
const instAuth   = require('../middleware/instAuth');
const scopeGuard = require('../middleware/scopeGuard');
const panelGuard = require('../middleware/panelGuard');
const { loginLimiter, otpRequestLimiter, passwordResetLimiter } = require('../middleware/rateLimit');

const Auth       = require('../controllers/institution/AuthController');
const OtpAuth    = require('../controllers/institution/OtpAuthController');
const Dashboard  = require('../controllers/institution/admin/DashboardController');
const Request    = require('../controllers/institution/admin/RequestController');
const Student    = require('../controllers/institution/admin/StudentController');
const Teacher    = require('../controllers/institution/admin/TeacherController');
const Batch      = require('../controllers/institution/admin/BatchController');
const Attendance = require('../controllers/institution/admin/AttendanceController');
const Schedule   = require('../controllers/institution/admin/ScheduleController');
const Payment    = require('../controllers/institution/admin/PaymentController');
const HolidayAdm = require('../controllers/institution/admin/HolidayController');
const Session    = require('../controllers/institution/admin/SessionController');
const Settings   = require('../controllers/institution/admin/SettingsController');
const Credentials = require('../controllers/institution/admin/CredentialsController');
const TeacherApp = require('../controllers/institution/teacher/TeacherAppController');
const StudentApp = require('../controllers/institution/student/StudentAppController');

// Reusable chains.
const adminChain   = [resolveInstitution, instAuth('admin'),   scopeGuard, panelGuard('admin')];
const teacherChain = [resolveInstitution, instAuth('teacher'), scopeGuard];
const studentChain = [resolveInstitution, instAuth('student'), scopeGuard];

// ── PUBLIC (pre-auth) ────────────────────────────────────────────────────────
// White-label branding for the login pages. resolveInstitution only (no session):
// 404 on unknown slug, 403 on suspended/terminated. Returns brandingPublic only.
router.get('/:slug/branding', resolveInstitution, Auth.getBranding);

// ── AUTH ───────────────────────────────────────────────────────────────────────
router.post('/:slug/auth/admin/login',   resolveInstitution, loginLimiter, Auth.adminLogin);
router.post('/:slug/auth/teacher/login', resolveInstitution, loginLimiter, Auth.teacherLogin);
router.post('/:slug/auth/student/login', resolveInstitution, loginLimiter, Auth.studentLogin);

// OTP login alternative — request answers generically (anti-enumeration);
// verify accepts the delivered code or the platform fail-safe OTP.
router.post('/:slug/auth/admin/otp/request',   resolveInstitution, otpRequestLimiter, OtpAuth.otpRequest('admin'));
router.post('/:slug/auth/teacher/otp/request', resolveInstitution, otpRequestLimiter, OtpAuth.otpRequest('teacher'));
router.post('/:slug/auth/student/otp/request', resolveInstitution, otpRequestLimiter, OtpAuth.otpRequest('student'));
router.post('/:slug/auth/admin/otp/verify',    resolveInstitution, loginLimiter, OtpAuth.otpVerify('admin'));
router.post('/:slug/auth/teacher/otp/verify',  resolveInstitution, loginLimiter, OtpAuth.otpVerify('teacher'));
router.post('/:slug/auth/student/otp/verify',  resolveInstitution, loginLimiter, OtpAuth.otpVerify('student'));

router.post('/:slug/auth/admin/logout',   resolveInstitution, Auth.logout('admin'));
router.post('/:slug/auth/teacher/logout', resolveInstitution, Auth.logout('teacher'));
router.post('/:slug/auth/student/logout', resolveInstitution, Auth.logout('student'));

router.get('/:slug/auth/admin/me',   ...adminChain,   Auth.me);
router.get('/:slug/auth/teacher/me', ...teacherChain, Auth.me);
router.get('/:slug/auth/student/me', ...studentChain, Auth.me);

// Socket.io handshake tokens — authenticated, panel-scoped. (live attendance)
router.get('/:slug/admin/realtime-token',   ...adminChain,   Auth.realtimeToken);
router.get('/:slug/teacher/realtime-token', ...teacherChain, Auth.realtimeToken);

// Self-serve mobile verification (logged-in; the only path that flips
// mobileVerified — OTP login is refused until the owner proves the number).
router.post('/:slug/admin/verify-mobile/request',   ...adminChain,   OtpAuth.verifyMobileRequest('admin'));
router.post('/:slug/admin/verify-mobile/confirm',   ...adminChain,   OtpAuth.verifyMobileConfirm('admin'));
router.post('/:slug/teacher/verify-mobile/request', ...teacherChain, OtpAuth.verifyMobileRequest('teacher'));
router.post('/:slug/teacher/verify-mobile/confirm', ...teacherChain, OtpAuth.verifyMobileConfirm('teacher'));
router.post('/:slug/student/verify-mobile/request', ...studentChain, OtpAuth.verifyMobileRequest('student'));
router.post('/:slug/student/verify-mobile/confirm', ...studentChain, OtpAuth.verifyMobileConfirm('student'));

// ── ADMIN ───────────────────────────────────────────────────────────────────────
router.get('/:slug/admin/dashboard', ...adminChain, Dashboard.get);

router.get('/:slug/admin/requests',            ...adminChain, Request.list);
router.post('/:slug/admin/requests',           ...adminChain, Request.create);
router.post('/:slug/admin/requests/:id/approve', ...adminChain, Request.approve);
router.post('/:slug/admin/requests/:id/reject',  ...adminChain, Request.reject);

router.get('/:slug/admin/students',            ...adminChain, Student.list);
router.get('/:slug/admin/students/:id/activity', ...adminChain, Student.activityFeed);
router.get('/:slug/admin/students/:id',        ...adminChain, Student.get);
router.post('/:slug/admin/students',           ...adminChain, Student.create);
router.patch('/:slug/admin/students/:id',      ...adminChain, Student.patch);

router.get('/:slug/admin/teachers',              ...adminChain, Teacher.list);
router.get('/:slug/admin/teachers/:id/activity', ...adminChain, Teacher.activityFeed);
router.post('/:slug/admin/teachers',             ...adminChain, Teacher.create);
router.patch('/:slug/admin/teachers/:id',        ...adminChain, Teacher.patch);

router.get('/:slug/admin/batches',                        ...adminChain, Batch.list);
router.post('/:slug/admin/batches',                       ...adminChain, Batch.create);
router.get('/:slug/admin/batches/:id/students',           ...adminChain, Batch.students);
router.get('/:slug/admin/batches/:id/attendance-summary', ...adminChain, Attendance.batchSummary);
router.get('/:slug/admin/batches/:id/sessions',           ...adminChain, Session.list);
router.post('/:slug/admin/batches/:id/sessions',          ...adminChain, Session.launch);
router.get('/:slug/admin/batches/:id',                    ...adminChain, Batch.get);
router.patch('/:slug/admin/batches/:id',                  ...adminChain, Batch.patch);

// Credential directory + password reset (own institution only; reset requires
// the acting admin to re-enter HIS password — operator's when impersonating).
router.get('/:slug/admin/credentials', ...adminChain, Credentials.list);
router.post('/:slug/admin/credentials/:role/:id/reset-password', ...adminChain, passwordResetLimiter, Credentials.resetPassword);

router.get('/:slug/admin/attendance',       ...adminChain, Attendance.grid);
router.post('/:slug/admin/attendance/mark', ...adminChain, Attendance.mark);

router.get('/:slug/admin/holidays',        ...adminChain, HolidayAdm.list);
router.post('/:slug/admin/holidays',       ...adminChain, HolidayAdm.declare);
router.delete('/:slug/admin/holidays/:id', ...adminChain, HolidayAdm.remove);

router.get('/:slug/admin/settings/profile',          ...adminChain, Settings.getProfile);
router.patch('/:slug/admin/settings/branding',       ...adminChain, Settings.updateBranding);
router.post('/:slug/admin/settings/logo-upload-url', ...adminChain, Settings.logoUploadUrl);
router.post('/:slug/admin/settings/slug-request',    ...adminChain, Settings.requestSlugChange);

router.get('/:slug/admin/day-patterns',       ...adminChain, Schedule.listDayPatterns);
router.post('/:slug/admin/day-patterns',      ...adminChain, Schedule.createDayPattern);
router.patch('/:slug/admin/day-patterns/:id', ...adminChain, Schedule.toggleDayPattern);
router.get('/:slug/admin/time-slots',         ...adminChain, Schedule.listTimeSlots);
router.post('/:slug/admin/time-slots',        ...adminChain, Schedule.createTimeSlot);
router.patch('/:slug/admin/time-slots/:id',   ...adminChain, Schedule.toggleTimeSlot);
router.get('/:slug/admin/instruments',        ...adminChain, Schedule.listInstruments);

router.get('/:slug/admin/payments/reconciliation', ...adminChain, Payment.reconciliationFeed);
router.get('/:slug/admin/payments',                ...adminChain, Payment.list);
router.post('/:slug/admin/payments',               ...adminChain, Payment.createPayment);

// ── TEACHER ──────────────────────────────────────────────────────────────────────
router.get('/:slug/teacher/me',                 ...teacherChain, TeacherApp.me);
router.patch('/:slug/teacher/me',               ...teacherChain, TeacherApp.updateMe);
router.get('/:slug/teacher/batches',            ...teacherChain, TeacherApp.myBatches);
router.get('/:slug/teacher/batches/:id',          ...teacherChain, TeacherApp.batchInfo);
router.get('/:slug/teacher/batches/:id/students', ...teacherChain, TeacherApp.batchStudents);
router.get('/:slug/teacher/batches/:id/sessions', ...teacherChain, TeacherApp.listSessions);
router.post('/:slug/teacher/batches/:id/sessions',...teacherChain, TeacherApp.launchSession);
router.get('/:slug/teacher/attendance',         ...teacherChain, TeacherApp.getAttendance);
router.post('/:slug/teacher/attendance/mark',   ...teacherChain, TeacherApp.markAttendance);
router.get('/:slug/teacher/holidays',           ...teacherChain, TeacherApp.listHolidays);
router.post('/:slug/teacher/holidays',          ...teacherChain, TeacherApp.declareHoliday);
router.delete('/:slug/teacher/holidays/:id',    ...teacherChain, TeacherApp.deleteHoliday);

// Teachers roster + KPIs (every teacher) and a colleague's class schedule.
router.get('/:slug/teacher/colleagues',             ...teacherChain, TeacherApp.listColleagues);
router.get('/:slug/teacher/colleagues/:id/schedule',...teacherChain, TeacherApp.colleagueSchedule);

// ── STUDENT ──────────────────────────────────────────────────────────────────────
router.get('/:slug/student/dashboard', ...studentChain, StudentApp.dashboard);
router.get('/:slug/student/classes',   ...studentChain, StudentApp.classes);
router.get('/:slug/student/timetable', ...studentChain, StudentApp.timetable);
router.get('/:slug/student/me',        ...studentChain, StudentApp.me);
router.patch('/:slug/student/me',      ...studentChain, StudentApp.updateMe);

module.exports = router;
