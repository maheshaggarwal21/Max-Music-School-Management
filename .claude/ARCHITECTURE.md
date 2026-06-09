# MaxMusic School Platform — Architecture
> Read-only reference. Session rules + golden rules live in CLAUDE.md.
> Schemas: orchestrate/data-model.md · API contracts: CONTRACTS.md · Board: orchestrate/tasks.md

---

## TABLE OF CONTENTS
1. The Business Model & The Pivot
2. Core Architectural Principles
3. Actors, Identity & PBAC
4. The Institution (Tenant) & Its Lifecycle
5. White-Label / Shadow Operation
6. Routing — Path-Based on a Neutral Domain
7. Data Architecture & Isolation
8. API Design — Namespacing & Middleware
9. Auth System — JWT, Cookies, Two-Level Invalidation
10. Impersonation (God-Mode Access)
11. Audit System — One Log, Two Surfaces
12. Payments — Tracking, Not Routing
13. Domain Workflows (the important flows)
14. The Panels — What Each Shows
15. Tech Stack — Every Tool & Why
16. Monorepo Structure
17. Infrastructure — Nginx, PM2, Crons
18. Build Sequence
19. Deferred Scope
20. Hard Rules

---

## 1. THE BUSINESS MODEL & THE PIVOT

Max Music School was a music school losing students to cheaper independent teachers. The
pivot: **stop being a school, become the umbrella operator behind independent teachers.**

A teacher comes to Max Music School. Max creates an **institution** named after the teacher
(e.g. "ABC Music School") — a complete mini music school with admin, teacher, and student
panels. The teacher operates under that brand. Students believe they are enrolled at "ABC
Music School" and never know Max Music School exists.

**Three onboarding scenarios:**
1. **Salaried teacher (managed).** Teacher teaches under Max on salary. Max runs the admin
   side; the teacher gets only teacher-panel access.
2. **Independent teacher (autonomous).** Teacher rents the platform, runs their own
   institution, manages their own batches/students/teachers, pays monthly rent.
3. **Salaried → independent.** A salaried teacher decides to go independent. Max flips them
   to autonomous: the **same login** now also opens the admin panel; billing flips
   salary → rent.

Each institution can have **its own set of teachers**, each with their own teacher-panel
login. New institutions are created **only** from the operator (superadmin) panel — never
from inside an institution.

---

## 2. CORE ARCHITECTURAL PRINCIPLES

1. **Pure operator.** No "main school" layer. Max Music School = the SaaS operator only.
   Every operational document belongs to an institution and carries a required, indexed
   `institutionId`. There is no `institutionId = null` operating data. The only
   platform-level account is the superadmin (`Operator`).
2. **One database, tenant-isolated by field.** A single MongoDB, single connection. Tenancy
   is enforced by the `institutionId` filter on every institution-scoped query — not by
   per-tenant databases. Simpler ops; trivial cross-institution analytics for the operator.
3. **White-label by default.** Institution panels show only the institution's brand.
4. **PBAC identity.** Access is a property of the account (`panelAccess`), not a separate
   credential per panel.
5. **Everything audited.** One immutable change log; every write recorded.

---

## 3. ACTORS, IDENTITY & PBAC

There are effectively **four roles** but only **three identity stores**.

| Role | Stored in | Panel | Exists |
|---|---|---|---|
| `superadmin` (Operator) | `Operator` | operator-panel | always (the client) |
| `institution_admin` | `Teacher` with `panelAccess ⊇ {admin}` | institution-admin-panel | autonomous owner, or superadmin impersonating |
| `teacher` | `Teacher` with `panelAccess ⊇ {teacher}` | institution-teacher-panel | every teacher |
| `student` | `Student` | institution-student-panel | every student |

### PBAC — the key idea
The institution admin is **not** a separate account. The owner teacher has ONE credential.
A `panelAccess` array on the `Teacher` decides which panels that login can enter:

```
panelAccess: ['teacher']            → managed:    teacher panel only
panelAccess: ['teacher', 'admin']   → autonomous: same login opens admin panel too
```

- **Granting admin** (scenario 3) = superadmin adds `'admin'` to the owner's `panelAccess`,
  flips `Institution.mode` to `autonomous`, and bumps `Teacher.tokenVersion`. On next login
  the same credentials open the admin panel. No new password, no provisioning email.
- **Revoking admin** = remove `'admin'`, flip `mode` to `managed`, bump `tokenVersion`.
- The admin panel app + `/api/inst/:slug/admin/*` routes are **always deployed for every
  institution** (managed included). What changes per mode is *who may authenticate*:
  managed → only the superadmin (via impersonation); autonomous → owner + superadmin.
- PBAC composes: an autonomous owner could later be allowed to grant a *staff* teacher
  admin access with no schema change. MVP keeps admin grants to the owner, toggled by the
  superadmin.

`mode` is the **billing** source of truth (managed = salary out, autonomous = rent in);
`panelAccess` is the **access** source of truth. The grant/revoke action moves both atomically.

---

## 4. THE INSTITUTION (TENANT) & ITS LIFECYCLE

An institution is one `Institution` document. Creating it provisions **no extra
infrastructure** — every child record simply carries its `institutionId`.

```
CREATED (status: pending)
   → superadmin activates
ACTIVE (status: active)
   → superadmin can SUSPEND (status: suspended, reversible — all logins 403, data kept)
   → superadmin can TERMINATE (status: terminated, permanent)
```

Mode toggle (`managed ↔ autonomous`) is superadmin-only and:
1. flips `Institution.mode`,
2. adds/removes `'admin'` on the owner `Teacher.panelAccess`,
3. bumps `Teacher.tokenVersion` (forces that teacher to re-login with new access),
4. records an audit entry (`TOGGLE_MODE`),
5. optionally emails the owner a branded "you now have admin access" notice (no credentials —
   they reuse their existing ones).

**Slug:** lowercase, hyphenated, unique, URL-safe; generated from the institution name;
**immutable**; used in every route and leads the public URL so it reads as the school name.

---

## 5. WHITE-LABEL / SHADOW OPERATION

Students must never learn Max Music School exists. This is enforced on three surfaces:

1. **On screen.** Every institution panel renders `Institution.branding`
   (`schoolName`, `logoUrl`, `primaryColor`, `tagline`). The operator's Steel-Blue brand and
   the "Max Music School" name appear on NONE of the institution panels.
2. **Emails.** Nodemailer sends with `from`-name = the institution's name. The Razorpay link
   is the teacher's own, so payment screens are already their brand.
3. **URL.** Institution panels live on a **neutral** `<PLATFORM_DOMAIN>` (never "maxmusic"),
   with the slug leading the path (`/<slug>/student`). The operator panel lives on a
   separate, private `<OPERATOR_DOMAIN>` that students are never linked to.

A Phase-8 QA gate explicitly greps the institution bundles + email templates for any
"maxmusic"/operator-brand leakage.

---

## 6. ROUTING — PATH-BASED ON A NEUTRAL DOMAIN

Frontend (one neutral domain, slug leads the path):
```
https://<PLATFORM_DOMAIN>/<slug>/student/...     → institution-student-panel  (:3003)
https://<PLATFORM_DOMAIN>/<slug>/teacher/...      → institution-teacher-panel  (:3002)
https://<PLATFORM_DOMAIN>/<slug>/admin/...        → institution-admin-panel    (:3001)
https://<OPERATOR_DOMAIN>/...                     → operator-panel             (:3000, private)
```
API (single host):
```
https://api.<PLATFORM_DOMAIN>/api/operator/...
https://api.<PLATFORM_DOMAIN>/api/inst/:slug/{admin,teacher,student}/...
```
Nginx routes by path regex (`^/[^/]+/(student|teacher|admin)/`) to the right Next app; the
panel segment always follows the slug, so slugs can't collide with reserved panel words.

> Custom per-school domains (`abcmusicschool.com`) are deliberately **out of MVP scope**
> (each would need per-tenant DNS + ACME). The neutral-domain + slug-path scheme already
> satisfies the shadow requirement.

---

## 7. DATA ARCHITECTURE & ISOLATION

Every institution-scoped model carries:
```
institutionId : ObjectId → Institution   (REQUIRED, indexed)
```
and the two mandatory compound indexes:
```
{ institutionId: 1, createdAt: -1 }   // paginated lists
{ institutionId: 1, status: 1 }       // filtered status queries
```

Query rules:
```
// ✅ institution-scoped — correct for every /api/inst/:slug/* query
Student.find({ institutionId: req.institution._id, status: 'active' })

// ✅ operator god-mode — ONLY under /api/operator/*
Student.find({ status: 'active' })

// ❌ never under /api/inst/:slug/* — cross-tenant leak
Student.find({ status: 'active' })
```

Platform-level collections (no `institutionId`): `Operator`, `Institution`, `RentInvoice`,
`RazorpayWebhookEvent`.

---

## 8. API DESIGN — NAMESPACING & MIDDLEWARE

```
/api/auth/operator/{login,logout,me,verify-2fa}
/api/operator/*                                      ← operatorAuth (superadmin only)
/api/inst/:slug/auth/{admin,teacher,student}/login
/api/inst/:slug/admin/*      ← resolveInstitution → instAuth('admin')   → scopeGuard → panelGuard('admin')
/api/inst/:slug/teacher/*    ← resolveInstitution → instAuth('teacher') → scopeGuard
/api/inst/:slug/student/*    ← resolveInstitution → instAuth('student') → scopeGuard
```

Middleware responsibilities are defined in CLAUDE.md → "MIDDLEWARE CHAINS". The operator
surface is the only one allowed to query across institutions.

---

## 9. AUTH SYSTEM — JWT, COOKIES, TWO-LEVEL INVALIDATION

- JWT payload: `{ sub, role, institutionId, panel, instVersion, userVersion, iat, exp }`.
- Stored in httpOnly + secure + sameSite cookies. Institution cookies are **path-scoped** to
  `/api/inst/:slug`. Cookie names: `operator_token`, `inst_admin_token`,
  `inst_teacher_token`, `inst_student_token`.
- Separate signing secrets per panel class prevent cross-panel token reuse.
- **Operator 2FA:** password → TOTP challenge → token. God-mode warrants the second factor.
- **Two-level invalidation:**
  - `instVersion` must equal `Institution.tokenVersion` (suspend / mode toggle → logs out the
    whole institution).
  - `userVersion` must equal `Teacher/Student.tokenVersion` (grant/revoke / password reset →
    logs out one user).

---

## 10. IMPERSONATION (GOD-MODE ACCESS)

The superadmin can open any institution's admin/teacher/student panel with one click.

```
POST /api/operator/institutions/:id/impersonate   { panel, targetUserId? }
  → issues a short-lived (e.g. 15 min) god-token bound to {institutionId, panel, operatorId}
  → returns the panel URL; opening it logs the superadmin in as that panel
```
- `instAuth` accepts the god-token, **bypasses** `scopeGuard` + `panelGuard`.
- Every write performed while impersonating is audited with `actorRole: 'superadmin'` and
  `impersonatedBy: operatorId`, so the institution's own change history shows it was the
  operator, not the local user.
- For multi-user panels (teacher/student), the operator picks a `targetUserId` to view-as.
- Managed institutions are administered entirely through this path (no local admin login exists).

---

## 11. AUDIT SYSTEM — ONE LOG, TWO SURFACES

A single immutable `AuditLog` collection is the source for:
- **Superadmin "Changes History" tab** — the whole platform's timeline (every institution),
  filterable by institution, action, actor, role, date.
- **Per-student activity feed** — the same rows filtered to one `entityId` (the
  "PAID AMOUNT changed from 0 to 6000 by Shivani" list in the student popup).

Each entry stores a structured `changes: [{field, from, to}]` array (renders the
human-readable lines) plus optional `before`/`after` snapshots with sensitive fields
stripped. Written via `auditLog()` with `{ w: 0 }` (fire-and-forget, never blocks). See
CLAUDE.md → "AUDIT LOG RULE".

---

## 12. PAYMENTS — TRACKING, NOT ROUTING

The app **tracks** money; it does not **route** it.

- **Student fees** are paid via each **teacher's own Razorpay payment link**. The admin sets
  the student's `paidAmount` / `upcomingAmount` / validity **manually** (matching the current
  product). Incoming Razorpay webhooks are stored as `RazorpayWebhookEvent` and shown as a
  read-only **reconciliation** feed in the Payments tab — they are not auto-attributed to
  students.
- **Salary** (managed institutions): `Teacher.salaryAmount` is recorded; actual disbursement
  is off-platform.
- **Rent** (autonomous institutions): tracked as `RentInvoice` records (period, amount, due
  date, status) that the superadmin marks paid. This is Max Music's revenue stream.
- The amount a teacher charges students (`paidAmount`/`upcomingAmount`) is visible on both
  the operator panel and the institution admin panel.

The operator "Payment History" shows two streams: **student fees** (across all institutions)
and **institution rents**.

---

## 13. DOMAIN WORKFLOWS

**Create institution (superadmin):** fill name (→ slug) + mode + owner teacher (pick existing
or create inline) + contact email + (rent amount if autonomous) → `Institution` created
(pending) → activate. If autonomous, owner's `panelAccess` includes `admin` from the start.

**Grant admin / go independent (scenario 3):** superadmin opens the institution → "Grant
Admin Access" → owner `panelAccess += 'admin'`, `mode = autonomous`, `Teacher.tokenVersion++`,
audit `TOGGLE_MODE` → owner's existing credentials now open the admin panel.

**Enrollment (two-step):** admin/owner adds student → `EnrollmentRequest` (pending, unpaid) →
admin approves → `Student` created (linked to request), display ID issued from the
per-institution counter.

**Batch composition:** admin defines reusable **Suitable Days** (day-patterns) and **Suitable
Times** (time-windows), then creates a **Batch** = instrument + day-pattern + time-slot +
optional teacher. A teacherless batch is in "Setting Phase".

**Attendance:** teacher marks present/absent per batch session per date (Socket.io pushes
live updates to students). Holidays credit a class back for regular/trial students.

**Student lifecycle (daily cron):** `active_soon` → `active` on start date; validity window
expiry → `inactive`. These transitions are audited as `actorRole: 'system'`.

---

## 14. THE PANELS — WHAT EACH SHOWS

### Operator panel (superadmin — private domain)
- **Dashboard** — KPIs: institutions (active/total), total students, total teachers, revenue
  (rents + a fee summary), recent changes, overdue rents.
- **Institutions** — table (name, slug, mode badge, owner, #students, #teachers, rent status,
  status); create; toggle mode / grant-revoke admin; suspend/reactivate; **impersonate**
  (open admin/teacher/student); drill-in detail page (teachers, students, batches, payments,
  audit — all filtered to that institution).
- **Students** — flat cross-institution list, each row tagged with its **institution** +
  **teacher**; fee (`paidAmount`/dues) visible; filters by institution/status/instrument/teacher.
- **Teachers** — flat cross-institution list, tagged by institution; role (owner/staff),
  employment (salary/rent), salary/rent amount visible.
- **Payment History** — two streams: student fees (all institutions) + institution rents.
- **Changes History** — global audit timeline; expandable before/after; full filters.
- **Settings** — operator profile + 2FA, default rent, email templates, instrument master.

### Institution admin panel (8 MVP tabs)
New Requests · Students · Teachers · Batches · Attendance · Suitable Days · Suitable Times ·
Payment History. Identical whether the owner or an impersonating superadmin is logged in.
Student row → rich detail popup (course config, schedule, fees, validity, present/absent,
per-student activity feed).

### Institution teacher panel
"Your Batches" (filterable by day) · batch student lists · mark attendance · holidays
(add/remove leave) · own profile card. Branded as the institution.

### Institution student panel
Dashboard (upcoming class, holiday notice, timetable, attendance %) · classes history ·
profile/credentials. Branded as the institution. (Static learning tools — metronome, tuner,
chords, certificates — are deferred.)

---

## 15. TECH STACK — EVERY TOOL & WHY

- **Express** — routes → middleware → controller; business logic only in controllers, auth
  only in middleware.
- **MongoDB + Mongoose** — flexible schema; `mongoose-paginate-v2` on every list; one
  connection, filtered by `institutionId`.
- **Turborepo** — 4 apps + 3 packages (`ui`, `types`, `utils`); build caching.
- **Next.js 14 (App Router)** — one app per panel; cookies via `credentials: 'include'`; no
  localStorage. Institution apps read `:slug` from the path and theme from `Institution.branding`.
- **JWT + httpOnly cookies + PBAC** — see §9.
- **AWS S3** — logos, profile pics, certificates (pre-signed uploads).
- **Nodemailer** — branded per-institution senders.
- **Razorpay** — per-teacher links; webhook reconciliation (§12).
- **Socket.io** — live attendance/class status; rooms keyed by `institutionId`.
- **node-cron** — daily student-status/validity transitions; rent-due flags; reminders.
- **PM2 + Nginx** — process management + reverse proxy / SSL.

---

## 16. MONOREPO STRUCTURE
See orchestrate/codebase.md for the authoritative file map. High level:
```
maxmusic/
├── apps/
│   ├── api/                          ← Express backend (single process)
│   ├── operator-panel/               ← Next.js: superadmin (private domain)
│   ├── institution-admin-panel/      ← Next.js: institution admin (8 tabs)
│   ├── institution-teacher-panel/    ← Next.js: institution teacher
│   └── institution-student-panel/    ← Next.js: institution student
├── packages/ { ui, types, utils }
├── .claude/ { CLAUDE.md, ARCHITECTURE.md, CONTRACTS.md, GSTACK.md, orchestrate/* }
├── turbo.json · package.json · nginx.conf · ecosystem.config.js
```

---

## 17. INFRASTRUCTURE — NGINX, PM2, CRONS

- **PM2** runs 5 processes: api(:4000) + the 4 panels(:3000–3003). `watch:false`,
  `max_memory_restart`, NODE_ENV=production, log paths.
- **Nginx** — path-regex routing on `<PLATFORM_DOMAIN>` for the 3 institution panels +
  separate server block for `<OPERATOR_DOMAIN>` + `api.<PLATFORM_DOMAIN>` → :4000. SSL via
  Let's Encrypt. Security headers; cookie-safe proxy headers.
- **Crons** (node-cron in the API process): daily student-status/validity sweep; rent-due
  flagging; fee/class reminders (Phase 7).

---

## 18. BUILD SEQUENCE
```
Phase 0 — Scaffold (4 apps + 3 pkgs), turbo, nginx path routing, PM2, env
Phase 1 — Models (core MVP set) + packages/types
Phase 2 — Auth + PBAC middleware (operator 2FA, instAuth, scopeGuard, panelGuard, impersonation)   ← /cso
Phase 3 — Operator APIs (institutions CRUD, grant/revoke admin, cross-inst views, impersonation, payments, changes)
Phase 4 — Institution APIs (admin 8 tabs, teacher, student)                                        ← /cso (isolation)
Phase 5 — Operator panel frontend                                                                  ← /qa
Phase 6 — Institution panels frontend + white-label theming                                        ← /qa (leak check)
Phase 7 — Razorpay webhook + reconciliation, daily cron, branded emails, Socket.io
Phase 8 — QA + security audit + deploy
```

---

## 19. DEFERRED SCOPE (schemas reserved, not built in MVP)
Video chapters/sessions + student progress · certificates · batch analytics · reports ·
announcements · trial-call AI/script · in-app notifications · automated fee/class reminder
records · custom per-school domains. The data model leaves room for these; don't build them
until the MVP eight-tab loop is solid.

---

## 20. HARD RULES
The non-negotiables are enumerated in CLAUDE.md → "WHAT NOT TO DO". The two most expensive to
get wrong, repeated here:
- **Isolation:** every `/api/inst/:slug/*` query filtered by `institutionId`; cross-tenant
  queries only under `/api/operator/*`. Run the grep self-check after every institution controller.
- **Shadow:** no Max Music School brand/name/domain on any institution panel, email, or URL.
