# Team Division — MaxMusic Platform
> Two developers. Every file has exactly one owner. No exceptions, no grey zones.
> Interface between both: `CONTRACTS.md` — the API spec neither side invents, both implement.

---

## THE SPLIT IN ONE LINE

**Dev A** → everything that touches MongoDB, Express, auth, security, infra, cron, sockets, payments.  
**Dev B** → everything the user sees: all 4 Next.js apps, the shared UI library, white-label theming.

---

## CRITICAL REALITIES TO ACCEPT BEFORE STARTING

1. **Dev B will be blocked early.** Phases 1–4 are all Dev A. Dev B's Phase 5–6 work cannot be fully wired until A finishes the APIs. Dev B does NOT sit idle — they build the entire design system and all page skeletons with mocked API responses during that gap.
2. **packages/types is the handoff artifact.** Dev A writes it (P1-12). Dev B reads it. B never writes to it — if a type is missing, B asks A to add it.
3. **The most dangerous code in this project is Phase 2.** `instAuth`, `scopeGuard`, `panelGuard`, and `impersonation` are where security breaks happen. Dev A must not rush these. The `/cso` checkpoint (P2-R) is mandatory before touching any controller.
4. **White-label correctness is Dev B's Phase 8 responsibility.** The string "Max Music School" and the operator domain must be completely absent from every institution panel bundle, every `<title>`, every email template. A grep failure here is a show-stopper.

---

## HANDOFF SCHEDULE

| # | Trigger | What becomes unblocked |
|---|---------|----------------------|
| **H1** | A completes P0-01, P0-02 (Turborepo root) | B can scaffold Next.js apps + package skeletons |
| **H2** | A completes P1-12 (packages/types export) | B has typed interfaces; starts building components properly |
| **H3** | A completes Phase 2 (all middleware + /cso pass) | B wires real auth cookies in login pages |
| **H4** | A completes Phase 3 (operator APIs + routes) | B wires operator panel pages against real API |
| **H5** | A completes Phase 4 (institution APIs + /cso pass) | B wires all 3 institution panels against real API |
| **H6** | A completes Phase 7 (payments, cron, socket) | B wires Razorpay reconciliation UI + live attendance Socket.io |

Announce handoffs in the team channel. B does not wait silently — at every gap, build the next UI layer with mocked data.

---

---

# DEV A — BACKEND · INFRA · SECURITY

---

## Phase 0 — Monorepo + Backend Scaffold

> Do P0-01 + P0-02 first and immediately push. B is blocked on these two files.

| ID | File / Deliverable |
|----|-------------------|
| P0-01 | `package.json` (root) + Turborepo `workspaces` config |
| P0-02 | `turbo.json` pipeline (build, dev, lint tasks) |
| P0-03 | `apps/api/` skeleton: `package.json`, `src/server.js` stub, full folder tree (`config/`, `models/`, `middleware/`, `controllers/`, `routes/`) |
| P0-06 | `nginx.conf` — path-regex routing `^/[^/]+/(student\|teacher\|admin)/` → correct port; separate server blocks for `<OPERATOR_DOMAIN>` and `api.<PLATFORM_DOMAIN>`; SSL stubs |
| P0-07 | `ecosystem.config.js` — PM2: api :4000, operator-panel :3000, institution panels :3001-3003 |
| P0-08 | `.env.example` — `PLATFORM_DOMAIN`, `OPERATOR_DOMAIN`, all JWT secrets (one per panel), `MONGO_URI`, `S3_*`, `RAZORPAY_*`, `SMTP_*`, `TOTP_*`; zero hardcoded domains |
| P0-09 | `scripts/seed.js` — superadmin with 2FA enabled + instrument master list + one demo institution |

---

## Phase 1 — All Mongoose Models + Shared Types

> Write models in this exact order — later models ref earlier ones.

| ID | File |
|----|------|
| P1-01 | `models/Operator.js` — `totpSecret select:false`, `tokenVersion`, `twoFactorEnabled` |
| P1-02 | `models/Institution.js` — `slug` immutable (pre-save hook that blocks updates), `mode`, `status`, `branding`, `rent`, `tokenVersion`, all lifecycle date stamps |
| P1-03 | `models/Teacher.js` — `panelAccess []`, `isOwner`, `tokenVersion`, `salaryAmount`, `razorpayPaymentLink`, `passwordHash select:false`, `recoveryOtp select:false` |
| P1-04 | `models/Student.js` — `joinStatus`, `validityStart/End/Days`, `paidClasses`, `upcomingClasses`, `paidAmount`, `upcomingAmount`, `tokenVersion`, `passwordHash select:false` |
| P1-05 | `models/EnrollmentRequest.js` — `status`, `paymentStatus`, `approvedStudentId`, `handledBy` |
| P1-06 | `models/Batch.js` — `dayPatternId`, `timeSlotId`, `teacherId` (null = Setting Phase), `studentCount` denormalized |
| P1-07 | `models/DayPattern.js` · `models/TimeSlot.js` · `models/Instrument.js` |
| P1-08 | `models/Attendance.js` · `models/Holiday.js` |
| P1-09 | `models/Payment.js` · `models/RentInvoice.js` · `models/RazorpayWebhookEvent.js` |
| P1-10 | `models/AuditLog.js` — `timestamps: { createdAt: true, updatedAt: false }`, no hard-delete, `w: 0` enforced at write site |
| P1-11 | `models/UniqueIdCounter.js` — atomic `$inc` for per-institution display IDs |
| P1-12 | `packages/types/models.ts` + `packages/types/api.ts` — mirror every schema field and every CONTRACTS.md response shape |
| P1-R | Run gstack `/plan-eng-review` on models — check index coverage, isolation guarantees |

→ **PUSH + announce H2 to Dev B immediately after P1-12.**

---

## Phase 2 — Auth + PBAC Middleware

> This is the highest-risk block in the project. Get the /cso pass before writing a single controller.

| ID | File |
|----|------|
| P2-01 | `config/db.js` — single Mongoose connection, connection error handling |
| P2-01 | `config/jwt.js` — `sign(payload, panel)` + `verify(token, panel)` using per-panel secrets; god-token issue (short TTL, `godMode: true` claim) |
| P2-01 | `config/helper.js` — `Helper.response(res, code, msg, data)` only; no bare `res.json()` anywhere |
| P2-01 | `config/auditLog.js` — `auditLog({...})` with `{ w: 0 }`; strips `password`, `passwordHash`, `recoveryOtp`, `totpSecret`, `jwt_token` before logging; never throws |
| P2-01 | `config/specialFunctions.js` — `generateSlug(name)`, `nextDisplayId(institutionId, entityType)` (atomic $inc on UniqueIdCounter), `encodeBatchName(instrument, dayPattern, timeSlot, mode)` |
| P2-01 | `config/strings.js` — all API message strings; no inline strings in controllers |
| P2-01 | `config/totp.js` — TOTP generate + verify (operator 2FA) |
| P2-01 | `config/s3.js` — pre-signed upload URL generator |
| P2-01 | `config/mailer.js` — Nodemailer transporter; `sendMail(institutionId, template, to, data)` uses `Institution.branding` as sender display name |
| P2-01 | `config/razorpay.js` — Razorpay client init + `verifyWebhookSignature()` |
| P2-01 | `config/socket.js` — Socket.io init; rooms named `inst:{institutionId}` |
| P2-01 | `config/cron.js` — node-cron stubs (implement in Phase 7) |
| P2-02 | `middleware/operatorAuth.js` — verify `operator_token` cookie; check `token.version === operator.tokenVersion`; require `twoFactorCompleted: true` claim |
| P2-03 | `middleware/resolveInstitution.js` — `:slug` → Institution doc (in-memory cache, TTL 5 min); unknown slug → 404 (never confirm existence); `suspended`/`terminated` → 403; sets `req.institution` |
| P2-04 | `middleware/instAuth.js` — `instAuth(panel)` factory; verify cookie JWT for that panel; check `token.instVersion === institution.tokenVersion` AND `token.userVersion === user.tokenVersion` (two-level); check `user.panelAccess.includes(panel)`; sets `req.actor` |
| P2-05 | `middleware/scopeGuard.js` — `req.actor.institutionId.equals(req.institution._id)` else 403; god-token bypasses |
| P2-06 | `middleware/panelGuard.js` — `panelGuard('admin')` factory; checks actor's `panelAccess ⊇ {admin}` for this institution; god-token bypasses |
| P2-07 | `middleware/impersonation.js` — accept god-token in `instAuth`; bypass scopeGuard + panelGuard; stamp `actorRole: 'superadmin'` + `impersonatedBy: operatorId` on every auditLog call |
| P2-08 | `middleware/rateLimit.js` — login throttle (express-rate-limit per IP); cookie `path` scoped to `/api/inst/:slug` so institution A's cookie never reaches institution B's routes |
| P2-R | **gstack `/cso` on ALL middleware — mandatory, do not skip, do not proceed to controllers without this pass** |

---

## Phase 3 — Operator (SaaS) API

| ID | File |
|----|------|
| P3-01 | `controllers/operator/AuthController.js` — `login` (email+password → set 2FA pending cookie), `verify-2fa` (TOTP → set full `operator_token`), `logout`, `me` |
| P3-02 | `controllers/operator/InstitutionController.js` — `create` (generateSlug, seed Instrument master), `list` (paginated, filters), `get`, `update` (NOT slug) |
| P3-03 | `InstitutionController` continued — `grantAdmin` (set `mode: autonomous`, add `admin` to owner's `panelAccess`, bump `institution.tokenVersion`), `revokeAdmin` (reverse, bump tokenVersion) |
| P3-04 | `InstitutionController` continued — `suspend` (bump `institution.tokenVersion`), `reactivate`, `terminate` (irreversible) |
| P3-05 | `InstitutionController` continued — `impersonate` (issue short-lived god-token for a slug; log to AuditLog with `action: IMPERSONATE`) |
| P3-06 | `controllers/operator/StudentsController.js` — cross-institution list (no institutionId filter; tagged with institution name + slug) |
| P3-07 | `controllers/operator/TeachersController.js` — cross-institution list; `employmentType` salary/rent tag; salary amount visible |
| P3-08 | `controllers/operator/PaymentsController.js` — student fees stream (all Payment docs, tagged) + RentInvoice stream + `markPaid` action |
| P3-09 | `controllers/operator/ChangesController.js` — global AuditLog timeline; filters: `action`, `actorRole`, `institutionId`, `entityType`, date range; paginated |
| P3-10 | `controllers/operator/DashboardController.js` — aggregations: institution count by mode/status, total students, total rent due; `SettingsController.js` — operator profile PATCH, 2FA toggle, default rent amount, instrument master CRUD |
| P3-11 | `routes/auth.js` (`/api/auth/operator/*`) + `routes/operator.js` (`/api/operator/*` with `operatorAuth` middleware) |
| P3-R | gstack `/review` on all operator controllers |

---

## Phase 4 — Institution API

| ID | File |
|----|------|
| P4-01 | `controllers/institution/AuthController.js` — `login` for each panel (admin/teacher/student); `me` (includes `Institution.branding` in response — this is how frontend applies white-label); `logout` (clear cookie) |
| P4-02 | `controllers/institution/admin/RequestController.js` — `list` (paginated, filter by status), `create` (from admin panel — direct enrollment path), `approve` (creates Student from Request + sets `approvedStudentId`), `reject` |
| P4-03 | `controllers/institution/admin/StudentController.js` — `list` (paginated, filter joinStatus/status/batchId/teacherId), `get` (full profile), `create` (direct, bypasses request), `patch` (paidAmount, upcomingAmount, batchId, teacherId, validity — every field change logged to AuditLog), `activityFeed` (AuditLog filtered by entityId = studentId) |
| P4-04 | `controllers/institution/admin/TeacherController.js` — `list`, `create`, `patch`; **admin CANNOT set `panelAccess` — only superadmin can; reject any request that includes `panelAccess` in the patch body** |
| P4-05 | `controllers/institution/admin/BatchController.js` — `list`, `create` (auto-run `encodeBatchName`), `patch`; re-encode name on any field update that affects it |
| P4-06 | `controllers/institution/admin/AttendanceController.js` — grid view: given a batchId + date range, return `{ students[], dates[], matrix[][] }` |
| P4-07 | `controllers/institution/admin/ScheduleController.js` — DayPattern CRUD + `toggle isActive`; TimeSlot CRUD + `toggle isOnline` |
| P4-08 | `controllers/institution/admin/PaymentController.js` — manual fee entry (creates Payment doc + updates `Student.paidAmount`); reconciliation feed (list RazorpayWebhookEvent filtered by institutionId, matched/unmatched) |
| P4-09 | `controllers/institution/teacher/TeacherAppController.js` — `myBatches` (batches where teacherId = me), `markAttendance` (upsert Attendance + emit Socket.io to `inst:{institutionId}` room), `declareHoliday` (create Holiday + credit classes to students by category), `me` |
| P4-10 | `controllers/institution/student/StudentAppController.js` — `dashboard` (validity window, paidClasses remaining, upcoming class), `classes` (attendance history), `timetable` (batch schedule), `me` |
| P4-11 | `routes/institution.js` — wire full middleware chains: `resolveInstitution → instAuth(panel) → scopeGuard → [panelGuard('admin')] → controller`; all routes under `/api/inst/:slug/{auth,admin,teacher,student}/*`; cookie path-scoping per slug |
| P4-R | **gstack `/cso` — run institutionId isolation grep on EVERY controller file. Zero tolerance. Fix all flagged lines before marking done.** |

---

## Phase 7 — Payments · Crons · Notifications · Socket

| ID | File |
|----|------|
| P7-01 | Razorpay webhook handler (`POST /api/webhooks/razorpay`) — `verifyWebhookSignature`, idempotency check (skip if `paymentId` already in RazorpayWebhookEvent), upsert RazorpayWebhookEvent; best-effort tag to institutionId via teacher's paymentLink |
| P7-02 | `config/cron.js` implement — daily at midnight: (a) `joinStatus active_soon → active` where `validityStart <= today`; (b) `joinStatus active → inactive` where `validityEnd < today`; both log AuditLog with `actorRole: 'system'` |
| P7-03 | Rent-due cron — sweep RentInvoice where `dueDate < today` and `status: pending` → set `status: overdue` |
| P7-04 | `config/mailer.js` implement templates — grant-admin notice (to owner teacher), fee reminder, rent reminder; sender display name = `Institution.branding.schoolName` |
| P7-05 | `config/socket.js` implement — on teacher `markAttendance`: emit `attendance:updated` event to room `inst:{institutionId}` with `{ batchId, studentId, date, status }` |

---

## Phase 8 — Dev A's Responsibilities

| ID | Task |
|----|------|
| P8-01 | gstack `/cso` — full isolation pass: re-run institutionId grep across every controller; check no operator route leaks `institutionId` filters |
| P8-02a | Audit all API responses + email templates for "Max Music School", operator domain, or any operator-identifying string |
| P8-04 | `nginx.conf` final — Let's Encrypt SSL for `<PLATFORM_DOMAIN>`, `<OPERATOR_DOMAIN>`, `api.<PLATFORM_DOMAIN>`; HTTPS redirect; `server_tokens off` |
| P8-05 | PM2 ecosystem final (`--env production`); run `seed.js` on VPS; verify superadmin 2FA flow end-to-end |
| P8-06 | gstack `/ship` — pre-deploy checklist |

---

---

# DEV B — FRONTEND · DESIGN SYSTEM · WHITE-LABEL

---

## Phase 0 — Frontend App Scaffold

> Wait for H1 (Dev A pushes P0-01 + P0-02). Then start immediately.

| ID | File |
|----|------|
| P0-04a | `apps/operator-panel/` — Next.js 14 App Router init, `package.json`, `tailwind.config.ts`, `src/app/layout.tsx` (Steel Blue `#5B8DEF` brand, `next-themes`), `src/app/(auth)/login/page.tsx` skeleton |
| P0-04b | `apps/institution-admin-panel/` — Next.js 14, `src/app/layout.tsx` with `BrandingProvider` stub (reads CSS vars, apply institution theme), `src/app/[slug]/(dashboard)/layout.tsx` |
| P0-04c | `apps/institution-teacher-panel/` — same structure as admin-panel, `[slug]` path |
| P0-04d | `apps/institution-student-panel/` — same structure, `[slug]` path; this panel is the most brand-sensitive |
| P0-05a | `packages/ui/` skeleton — `package.json`, `src/index.ts` barrel export, empty component files for: `DataTable`, `Modal`, `StatusBadge`, `StatsCard`, `Sidebar`, `Form/*`, `SearchBar`, `Avatar`, `Charts`, `BlurFade` |
| P0-05b | `packages/utils/` skeleton — `formatters.ts` (date, currency INR paise→display, phone), `validators.ts` (phone, email, slug), `constants.ts` (enums: `joinStatus`, `mode`, `status`, `panelAccess`, `roles`) |

---

## Design System Build (parallel with Dev A's Phases 1–4)

> This is your core output while A builds backend. Every component built here is used across all 4 panels. Do not skip specs — wrong component behavior discovered in Phase 6 is expensive to fix.

**Stack constraints (hard rules, do not substitute):**
- `motion/react` — NOT `framer-motion`
- `radix-ui` — NOT `@radix-ui/react-slot`
- `lucide-react` for icons
- `tailwindcss v4`
- `sonner` for toasts
- `next-themes` for dark/light
- NO pink anywhere in any panel

**Components to build in `packages/ui`:**

| Component | Key behaviour |
|-----------|--------------|
| `DataTable` | Sortable columns, server-side pagination (`page`, `limit`, `total`, `pages` from API), row-click callback, optional row actions |
| `Modal` | Controlled open/close, `<BlurFade>` entrance, trap focus, close on Escape |
| `StatusBadge` | Color-maps: `joinStatus` (trial=gray, active=green, inactive=red, active_soon=yellow), `mode` (managed=blue, autonomous=purple), `status` (active/inactive/pending/suspended/terminated) |
| `StatsCard` | Icon + label + value + optional delta; `<BlurFade>` on mount |
| `Sidebar` | Collapsible, nav items with active state, institution logo + school name slot (white-label aware), `next-themes` toggle |
| `Form/Input` | Controlled, error state, label, required indicator |
| `Form/Select` | Controlled, searchable option, multi-select variant |
| `Form/DatePicker` | Single date + date range; INR locale |
| `Form/FileUpload` | Calls pre-signed S3 URL; progress indicator; returns uploaded URL |
| `SearchBar` | Debounced (300ms), clears on Escape |
| `Avatar` | Image with initials fallback; sizes sm/md/lg |
| `Charts` | Line (attendance trend), Bar (payments), used in dashboards |
| `BlurFade` | Wrapper that blur-fades children in on mount; wrap every page section |

**`packages/utils` implementations (not stubs, implement fully):**
- `formatCurrency(paise)` → `₹ 6,000`
- `formatDate(isoString)` → `12 Jan 2026`
- `formatPhone(str)` → `+91 98765 43210`
- `joinStatusLabel(status)` → human label
- All enums from `packages/types/api.ts` (wait for H2, then replace stubs)

---

## Phase 5 — Operator Panel Pages

> Start after H4. Wire against real API. Use `packages/types/api.ts` for response shapes.

**`apps/operator-panel/src/lib/`:**
- `api.ts` — typed fetch wrappers for all `/api/operator/*` endpoints; reads `NEXT_PUBLIC_API_URL` from env; includes credentials for cookies; handles `Helper.response()` shape `{ success, message, data }`
- `auth.ts` — `useOperatorSession()` hook; redirect to login if cookie missing; no localStorage

| ID | Page / Feature |
|----|---------------|
| P5-02 | `/login` — email + password form; on success if `requires2FA: true` show TOTP input; set `operator_token` cookie via API; redirect to dashboard |
| P5-03 | `/dashboard` — stats cards (institution count by mode/status, total students, total rent due) + charts; data from `DashboardController`; every card `<BlurFade>` |
| P5-04 | `/institutions` — `DataTable` (name, slug, mode badge, status badge, student count, created date); **Create Institution modal** (name, contact email, mode — slug auto-shown as preview); **Institution Detail drawer** (full info + action buttons: Grant Admin / Revoke Admin, Suspend / Reactivate, Terminate, Impersonate) |
| P5-05 | `/students` — cross-institution `DataTable`; institution tag filter chip; search by name/mobile; click row → student detail |
| P5-06 | `/teachers` — cross-institution `DataTable`; `employmentType` badge (salary/rent); salary amount column |
| P5-07 | `/payments` — two tabs: **Student Fees** (all Payment docs tagged by institution) and **Rent Invoices** (RentInvoice list with Mark Paid action + reference input) |
| P5-08 | `/changes` — timeline view (newest first); each entry: actor name + role badge, action string, entity label, `changes[]` rendered as "FIELD changed from X to Y"; expandable `before`/`after` JSON; filters: institution select, action search, date range |
| P5-09 | `/settings` — tabs: **Profile** (name, email, password change), **2FA** (enable/disable TOTP, QR code display), **Default Rent** (amount + billing cycle), **Instruments** (master list: add/toggle active) |
| P5-R | gstack `/qa` on operator panel |

---

## Phase 6 — Institution Panels

### White-Label Theming Layer (implement first — all 3 panels depend on it)

| File | What it does |
|------|-------------|
| `BrandingProvider.tsx` (shared across all 3 institution apps) | On mount: call `GET /api/inst/:slug/auth/*/me` (or a public branding endpoint) → inject `--primary: {branding.primaryColor}`, `--school-name: "{branding.schoolName}"` as CSS vars; set `document.title = branding.schoolName`; render institution logo from `branding.logoUrl` |
| All institution `layout.tsx` files | Use `--primary` CSS var for all brand color references; use `branding.schoolName` for all header text, email-style displays, tab titles |

**Mandatory check before P6-R:** `grep -r "Max Music\|maxmusic\|OPERATOR_DOMAIN" apps/institution-*`  
Zero matches required. Any match = show-stopper bug.

---

### Admin Panel (`apps/institution-admin-panel`)

| ID | Page / Feature |
|----|---------------|
| P6-02a | `/[slug]/admin/login` — admin credential; branding applied (school name + logo + primary color) |
| P6-02b | `/[slug]/admin/students` — `DataTable` (displayId, name, mobile, joinStatus badge, batch, teacher, paidAmount, validityEnd); **Student Detail popup**: full profile tabs — Info, Payments, Activity Feed (AuditLog timeline for this student), actions: patch fee amounts, assign batch/teacher, set validity |
| P6-02c | `/[slug]/admin/requests` — pending requests list; **Approve** (opens student creation form prefilled from request data); **Reject** with reason |
| P6-02d | `/[slug]/admin/teachers` — list; **Add Teacher modal** (name, email, mobile, gender, salary amount if managed) |
| P6-02e | `/[slug]/admin/batches` — list with encoded batch name; **Create Batch modal** (instrument select, day-pattern select, time-slot select, teacher select, mode toggle); batch name auto-previewed |
| P6-02f | `/[slug]/admin/attendance` — date range picker + batch selector → attendance grid (rows = students, columns = dates, cells = present/absent/holiday/credited badges) |
| P6-02g | `/[slug]/admin/schedule` — two sections: **Suitable Days** (tag-style list, Active/Disabled toggle per pattern) + **Suitable Times** (list, Online toggle per slot); add new day-pattern + time-slot forms |
| P6-02h | `/[slug]/admin/payments` — **Manual Entry form** (student select, amount, period, method, paidAt); **Reconciliation Feed** list (Razorpay webhook events, matched/unmatched indicator) |

---

### Teacher Panel (`apps/institution-teacher-panel`)

| ID | Page / Feature |
|----|---------------|
| P6-03a | `/[slug]/teacher/login` — teacher credential; branded |
| P6-03b | `/[slug]/teacher/batches` — list of my assigned batches; click → batch detail with student roster |
| P6-03c | `/[slug]/teacher/attendance` — select batch + date; student list with Present/Absent toggle; Submit → API call + Socket.io reflects live update for any other tab open on the same institution |
| P6-03d | `/[slug]/teacher/holidays` — declare holiday form (batch select, date, student category, reason); list of past holidays |
| P6-03e | `/[slug]/teacher/profile` — `me` data; read-only |

---

### Student Panel (`apps/institution-student-panel`)

| ID | Page / Feature |
|----|---------------|
| P6-04a | `/[slug]/student/login` — student credential; fully institution-branded (most public-facing surface) |
| P6-04b | `/[slug]/student/dashboard` — paid classes remaining, validity end date, next scheduled class; branded header with school logo |
| P6-04c | `/[slug]/student/classes` — attendance history list (date, status badge, batch) |
| P6-04d | `/[slug]/student/timetable` — weekly view of the student's batch schedule |
| P6-04e | `/[slug]/student/profile` — `me` data; read-only |

| P6-R | gstack `/qa` — test managed flow (superadmin impersonates) + autonomous flow (owner logs in as admin); run white-label grep; verify zero Max Music leakage in page source, HTML title, and network responses visible to the student panel |

---

## Phase 8 — Dev B's Responsibilities

| ID | Task |
|----|------|
| P8-02b | Grep all 4 app bundles after build for `maxmusic`, `Max Music`, `OPERATOR_DOMAIN`; zero matches required |
| P8-03 | gstack `/qa` — full E2E: (1) salary teacher flow, (2) independent/autonomous teacher flow, (3) salary → independent flip via Grant Admin button; verify correct panel access before and after flip |

---

---

## FILE OWNERSHIP REFERENCE

> If a file isn't listed but its folder is, the folder owner owns all files in it.

| Path | Owner |
|------|-------|
| `apps/api/**` | **Dev A** |
| `nginx.conf` | **Dev A** |
| `ecosystem.config.js` | **Dev A** |
| `.env.example` | **Dev A** |
| `scripts/seed.js` | **Dev A** |
| `packages/types/**` | **Dev A** (B reads, never writes) |
| `apps/operator-panel/**` | **Dev B** |
| `apps/institution-admin-panel/**` | **Dev B** |
| `apps/institution-teacher-panel/**` | **Dev B** |
| `apps/institution-student-panel/**` | **Dev B** |
| `packages/ui/**` | **Dev B** |
| `packages/utils/**` | **Dev B** |
| `package.json` (root) | **Dev A** (B requests workspace additions) |
| `turbo.json` | **Dev A** |
| `ARCHITECTURE.md`, `CONTRACTS.md`, `CLAUDE.md`, `data-model.md`, `tasks.md` | Read-only for both; modify only with joint agreement |

---

## CONFLICT PREVENTION RULES

1. One file, one owner. No exceptions. If ownership is ambiguous, resolve it now not when you're both editing.
2. Dev B requests type additions via message to Dev A — B never touches `packages/types`.
3. Dev B mocks all API responses until the relevant handoff — never hard-block waiting on A.
4. Branches: `backend/*` for A, `frontend/*` for B. Merge to `main` only at handoff points.
5. The contracts in `CONTRACTS.md` are frozen during implementation. A spec change requires both to agree; whoever discovers the need raises it immediately.
6. Dev B never adds backend dependencies to `apps/api/package.json`. A never adds UI dependencies to frontend apps.
7. If a shared utility is needed by both frontend and backend, it goes in `packages/utils` (B owns it) — A imports from there, never duplicates.
