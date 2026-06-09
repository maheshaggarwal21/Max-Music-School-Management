# Codebase Map
> Where every file lives and what it owns. Never guess locations — check here first.
> Architecture: ../ARCHITECTURE.md · Schemas: data-model.md · API: ../CONTRACTS.md

---

## BACKEND: apps/api/

```
apps/api/
└── src/
    ├── server.js                     ← Entry. Registers routes, DB, Socket.io, crons.
    ├── config/
    │   ├── db.js                      ← Mongoose connect (single connection)
    │   ├── jwt.js                     ← sign/verify; per-panel secrets; god-token issue
    │   ├── password.js                ← bcrypt hash/compare (cost 12); randomTempPassword()
    │   ├── instAuthHelpers.js         ← brandingPublic() + issuePanelCookie() (embeds instVersion+userVersion)
    │   ├── helper.js                  ← Helper.response(res, code, msg, data)
    │   ├── auditLog.js                ← auditLog() with { w: 0 }; strips secrets
    │   ├── specialFunctions.js        ← generateSlug(), nextDisplayId(), encodeBatchName()
    │   ├── strings.js                 ← All message strings
    │   ├── totp.js                    ← Operator 2FA (generate/verify)
    │   ├── s3.js                      ← AWS S3 (pre-signed uploads)
    │   ├── mailer.js                  ← Nodemailer; per-institution branded sender
    │   ├── razorpay.js                ← Razorpay client + webhook signature verify
    │   ├── socket.js                  ← Socket.io; rooms keyed by institutionId
    │   └── cron.js                    ← node-cron: status/validity sweep, rent-due
    │
    ├── models/                        ← see data-model.md for full specs
    │   ├── Operator.js
    │   ├── Institution.js
    │   ├── Teacher.js                 ← panelAccess (PBAC), isOwner, tokenVersion
    │   ├── Student.js                 ← joinStatus, validity, paid/upcoming amounts
    │   ├── EnrollmentRequest.js
    │   ├── Batch.js
    │   ├── DayPattern.js
    │   ├── TimeSlot.js
    │   ├── Instrument.js
    │   ├── Attendance.js
    │   ├── Holiday.js
    │   ├── Payment.js
    │   ├── RentInvoice.js             ← platform-level (operator revenue)
    │   ├── RazorpayWebhookEvent.js    ← platform-level (reconciliation feed)
    │   ├── AuditLog.js                ← immutable; Changes History + per-student activity
    │   └── UniqueIdCounter.js         ← per-institution display-ID sequences
    │   # DEFERRED (reserve names): VideoChapter, VideoSession, StudentVideoProgress,
    │   #   Certificate, Announcement, TrialCallLog, Notification, FeeReminder, ClassReminder
    │
    ├── middleware/
    │   ├── operatorAuth.js            ← verify operator_token (+2FA-completed)
    │   ├── resolveInstitution.js      ← :slug → req.institution (cache; 404 unknown; 403 suspended)
    │   ├── instAuth.js                ← instAuth(panel): 2-level tokenVersion + panelAccess
    │   ├── scopeGuard.js              ← actor.institutionId === institution._id
    │   ├── panelGuard.js              ← panelGuard('admin') PBAC check
    │   ├── impersonation.js           ← accept god-token; bypass scope/panel; stamp impersonatedBy
    │   └── rateLimit.js               ← login throttling
    │
    ├── controllers/
    │   ├── operator/
    │   │   ├── AuthController.js          ← login, verify-2fa, logout, me
    │   │   ├── InstitutionController.js   ← CRUD, slug gen, grant/revoke-admin, suspend, terminate, impersonate
    │   │   ├── StudentsController.js      ← cross-institution tagged list
    │   │   ├── TeachersController.js      ← cross-institution tagged list
    │   │   ├── PaymentsController.js      ← student fees + rent invoices + mark-paid
    │   │   ├── ChangesController.js       ← global audit timeline
    │   │   ├── DashboardController.js     ← aggregations
    │   │   └── SettingsController.js      ← profile, 2FA, default rent, instrument master
    │   └── institution/
    │       ├── AuthController.js          ← admin/teacher/student login, me, logout (+ branding)
    │       ├── admin/
    │       │   ├── RequestController.js   ← list/create/approve/reject
    │       │   ├── StudentController.js   ← list/detail/create/patch + /activity feed
    │       │   ├── TeacherController.js   ← list/create/patch (NO admin grant)
    │       │   ├── BatchController.js     ← list/create/patch (name auto-encode)
    │       │   ├── AttendanceController.js← grid view
    │       │   ├── ScheduleController.js  ← day-patterns + time-slots (+toggles)
    │       │   └── PaymentController.js   ← manual entry + reconciliation feed
    │       ├── teacher/
    │       │   └── TeacherAppController.js← batches, attendance mark, holidays, me
    │       └── student/
    │           └── StudentAppController.js← dashboard, classes, timetable, me
    │
    └── routes/
        ├── auth.js            ← /api/auth/operator/*
        ├── operator.js        ← /api/operator/*  (operatorAuth)
        └── institution.js     ← /api/inst/:slug/{auth,admin,teacher,student}/*  (full chains)
```

---

## FRONTEND APPS (4)

Each is a Next.js 14 App-Router app. Institution apps read `:slug` from the path and theme
from `Institution.branding` (white-label).

```
apps/operator-panel/                 :3000  private <OPERATOR_DOMAIN>   (Steel Blue brand)
apps/institution-admin-panel/        :3001  <PLATFORM_DOMAIN>/<slug>/admin
apps/institution-teacher-panel/      :3002  <PLATFORM_DOMAIN>/<slug>/teacher
apps/institution-student-panel/      :3003  <PLATFORM_DOMAIN>/<slug>/student
```

Shared per-app structure:
```
apps/[panel]/src/
├── app/
│   ├── layout.tsx                 ← (institution apps) BrandingProvider sets CSS vars + <title>
│   ├── (auth)/login/page.tsx
│   └── [slug]/(dashboard)/[feature]/page.tsx   ← institution apps capture slug here
├── components/
├── lib/{ api.ts, auth.ts, branding.ts, utils.ts }
├── hooks/
└── types/
```

API base URL (env, never hardcoded):
```
operator-panel:               NEXT_PUBLIC_API_URL = https://api.<PLATFORM_DOMAIN>/api/operator
institution-* (all three):    NEXT_PUBLIC_API_URL = https://api.<PLATFORM_DOMAIN>/api/inst
                               (slug appended at call time → /api/inst/:slug/<panel>/...)
```

---

## SHARED PACKAGES

```
packages/ui/components/        ← DataTable, Modal, StatusBadge, StatsCard, Sidebar,
                                 Form (Input/Select/DatePicker/FileUpload), SearchBar, Avatar, Charts
packages/types/                ← models.ts (mirror data-model.md) + api.ts (mirror CONTRACTS.md)
packages/utils/                ← formatters (date/currency/phone), validators (phone/email/slug),
                                 constants (enums: joinStatus, mode, status, panelAccess, roles)
```

---

## INFRASTRUCTURE

```
maxmusic/
├── nginx.conf            ← path-regex routing on <PLATFORM_DOMAIN> (3 inst panels)
│                            + server blocks for <OPERATOR_DOMAIN> and api.<PLATFORM_DOMAIN>; SSL
├── ecosystem.config.js   ← PM2: api(:4000) + 4 panels(:3000-3003)
├── .env.example          ← PLATFORM_DOMAIN, OPERATOR_DOMAIN, JWT secrets, Mongo, S3, Razorpay, SMTP, TOTP
└── scripts/
    ├── seed.js           ← superadmin (with 2FA) + instrument master + a demo institution
    └── migrate.js        ← future
```

---

## FILE CREATION ORDER (follows tasks.md phases)
```
Phase 0  scaffold (turbo, 4 apps, 3 pkgs, nginx, pm2, env, seed)
Phase 1  models/* + packages/types
Phase 2  config/* + middleware/* (auth, PBAC, impersonation)        ← /cso
Phase 3  controllers/operator/* + routes/{auth,operator}.js
Phase 4  controllers/institution/* + routes/institution.js          ← /cso (isolation)
Phase 5  packages/ui + operator-panel pages                          ← /qa
Phase 6  3 institution panels + white-label theming                 ← /qa (leak check)
Phase 7  razorpay webhook, cron, mailer, socket
Phase 8  /cso, leak audit, /qa, nginx+SSL, pm2+seed, /ship
```

---

## CURRENT FILE STATUS
> Dev A updates this as backend files are completed. Dev B tracks frontend separately.
> Legend: ⬜ not started · 🔄 in progress · ✅ done · ❌ blocked

### Dev A files (backend + infra)
| File | Status | Notes |
|------|--------|-------|
| package.json (root) | ✅ | P0-01 |
| turbo.json | ✅ | P0-02 → H1 |
| apps/api/ skeleton | ✅ | P0-03 — server.js + all stubs |
| nginx.conf | ✅ | P0-06 |
| ecosystem.config.js | ✅ | P0-07 — 5 PM2 procs |
| .env.example | ✅ | P0-08 |
| scripts/seed.js | ✅ | P0-09 stub — implement after P1-01..P1-11 |
| models/* (16 files) | ✅ | Phase 1 + P1-R review — all schemas, indexes, pre-hooks; +mobile/instrument/employmentType indexes; +findOneAndUpdate label hooks; +slug $setOnInsert guard |
| packages/types/* | ✅ | P1-12 → H2 — models.ts + api.ts exported |
| config/* (14 files) | ✅ | P2-01 base + Phase 3/4 added password.js + instAuthHelpers.js; mailer/razorpay/socket/cron still Phase 7 stubs |
| middleware/* (7 files) | ✅ | P2-02..P2-08 — operatorAuth, resolveInstitution, instAuth, scopeGuard, panelGuard, impersonation, rateLimit |
| controllers/operator/* (9) | ✅ | Phase 3 — auth+institution lifecycle+cross-inst reads+payments+changes+dashboard+settings; P3-R /review ✅ |
| controllers/institution/* (10) | ✅ | Phase 4 — auth + 7 admin + teacher + student; golden-rule isolation self-check clean; P4-R /cso PENDING |
| routes/auth.js · operator.js | ✅ | Phase 3 — 29 operator routes behind operatorAuth |
| routes/institution.js | ✅ | Phase 4 — 46 routes; full chains resolveInstitution→instAuth→scopeGuard→[panelGuard] |
