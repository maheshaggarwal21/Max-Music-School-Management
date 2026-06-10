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
const { loginLimiter } = require('../middleware/rateLimit');

const Auth       = require('../controllers/institution/AuthController');
const Request    = require('../controllers/institution/admin/RequestController');
const Student    = require('../controllers/institution/admin/StudentController');
const Teacher    = require('../controllers/institution/admin/TeacherController');
const Batch      = require('../controllers/institution/admin/BatchController');
const Attendance = require('../controllers/institution/admin/AttendanceController');
const Schedule   = require('../controllers/institution/admin/ScheduleController');
const Payment    = require('../controllers/institution/admin/PaymentController');
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

router.post('/:slug/auth/admin/logout',   resolveInstitution, Auth.logout('admin'));
router.post('/:slug/auth/teacher/logout', resolveInstitution, Auth.logout('teacher'));
router.post('/:slug/auth/student/logout', resolveInstitution, Auth.logout('student'));

router.get('/:slug/auth/admin/me',   ...adminChain,   Auth.me);
router.get('/:slug/auth/teacher/me', ...teacherChain, Auth.me);
router.get('/:slug/auth/student/me', ...studentChain, Auth.me);

// Socket.io handshake tokens — authenticated, panel-scoped. (live attendance)
router.get('/:slug/admin/realtime-token',   ...adminChain,   Auth.realtimeToken);
router.get('/:slug/teacher/realtime-token', ...teacherChain, Auth.realtimeToken);

// ── ADMIN ───────────────────────────────────────────────────────────────────────
router.get('/:slug/admin/requests',            ...adminChain, Request.list);
router.post('/:slug/admin/requests',           ...adminChain, Request.create);
router.post('/:slug/admin/requests/:id/approve', ...adminChain, Request.approve);
router.post('/:slug/admin/requests/:id/reject',  ...adminChain, Request.reject);

router.get('/:slug/admin/students',            ...adminChain, Student.list);
router.get('/:slug/admin/students/:id/activity', ...adminChain, Student.activityFeed);
router.get('/:slug/admin/students/:id',        ...adminChain, Student.get);
router.post('/:slug/admin/students',           ...adminChain, Student.create);
router.patch('/:slug/admin/students/:id',      ...adminChain, Student.patch);

router.get('/:slug/admin/teachers',       ...adminChain, Teacher.list);
router.post('/:slug/admin/teachers',      ...adminChain, Teacher.create);
router.patch('/:slug/admin/teachers/:id', ...adminChain, Teacher.patch);

router.get('/:slug/admin/batches',       ...adminChain, Batch.list);
router.post('/:slug/admin/batches',      ...adminChain, Batch.create);
router.patch('/:slug/admin/batches/:id', ...adminChain, Batch.patch);

router.get('/:slug/admin/attendance', ...adminChain, Attendance.grid);

router.get('/:slug/admin/day-patterns',       ...adminChain, Schedule.listDayPatterns);
router.post('/:slug/admin/day-patterns',      ...adminChain, Schedule.createDayPattern);
router.patch('/:slug/admin/day-patterns/:id', ...adminChain, Schedule.toggleDayPattern);
router.get('/:slug/admin/time-slots',         ...adminChain, Schedule.listTimeSlots);
router.post('/:slug/admin/time-slots',        ...adminChain, Schedule.createTimeSlot);
router.patch('/:slug/admin/time-slots/:id',   ...adminChain, Schedule.toggleTimeSlot);

router.get('/:slug/admin/payments/reconciliation', ...adminChain, Payment.reconciliationFeed);
router.get('/:slug/admin/payments',                ...adminChain, Payment.list);
router.post('/:slug/admin/payments',               ...adminChain, Payment.createPayment);

// ── TEACHER ──────────────────────────────────────────────────────────────────────
router.get('/:slug/teacher/me',                 ...teacherChain, TeacherApp.me);
router.get('/:slug/teacher/batches',            ...teacherChain, TeacherApp.myBatches);
router.get('/:slug/teacher/batches/:id/students', ...teacherChain, TeacherApp.batchStudents);
router.get('/:slug/teacher/attendance',         ...teacherChain, TeacherApp.getAttendance);
router.post('/:slug/teacher/attendance/mark',   ...teacherChain, TeacherApp.markAttendance);
router.get('/:slug/teacher/holidays',           ...teacherChain, TeacherApp.listHolidays);
router.post('/:slug/teacher/holidays',          ...teacherChain, TeacherApp.declareHoliday);
router.delete('/:slug/teacher/holidays/:id',    ...teacherChain, TeacherApp.deleteHoliday);

// ── STUDENT ──────────────────────────────────────────────────────────────────────
router.get('/:slug/student/dashboard', ...studentChain, StudentApp.dashboard);
router.get('/:slug/student/classes',   ...studentChain, StudentApp.classes);
router.get('/:slug/student/timetable', ...studentChain, StudentApp.timetable);
router.get('/:slug/student/me',        ...studentChain, StudentApp.me);

module.exports = router;
