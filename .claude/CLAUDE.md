# MaxMusic School Platform — Master Memory
> Claude Code reads this file at the start of EVERY session, before touching anything.
> Every agent, every sub-session, every task — read this first.
> Full reference: ARCHITECTURE.md · Schemas: orchestrate/data-model.md · API: CONTRACTS.md · Board: orchestrate/tasks.md

---

## WHAT WE ARE BUILDING

A **white-label, multi-tenant music-school SaaS platform**. Max Music School is NOT a
school that takes students anymore — it is the **operator behind the curtain**. Individual
music teachers come under its umbrella; each teacher gets a fully-branded "mini music
school" (an **institution**) with its own admin, teacher, and student panels.

### The business model in one picture
```
        MAX MUSIC SCHOOL  (the operator — invisible to students)
                 │  creates & oversees every institution (god-mode)
   ┌─────────────┼───────────────────────────────┐
   ▼             ▼                                ▼
ABC Music     Sitar House                    Tabla Academy
School        Delhi                          Punjab
(institution) (institution)                  (institution)
 ├ admin panel    ├ admin panel                ├ admin panel
 ├ teacher panel  ├ teacher panel              ├ teacher panel
 └ student panel  └ student panel              └ student panel
```

### The three onboarding scenarios → two stored states
| Scenario | Owner teacher gets | Billing | Stored as |
|---|---|---|---|
| 1. Teacher joins on **salary** | teacher panel only | Max pays salary | `mode: managed`, owner `panelAccess: ['teacher']` |
| 2. Teacher runs **independently** (rent) | admin + teacher panels | Teacher pays rent | `mode: autonomous`, owner `panelAccess: ['teacher','admin']` |
| 3. Salaried teacher **goes independent** | superadmin clicks "Grant Admin Access" | salary → rent | mode flips managed→autonomous, `'admin'` added to owner's `panelAccess` |

---

## NON-NEGOTIABLE FIRST PRINCIPLES

1. **PURE OPERATOR.** There is no "main school." Max Music School never runs its own
   batches/students/teachers. EVERY operational record (student, teacher, batch,
   attendance, request, day-pattern, time-slot, payment, holiday, audit entry) belongs to
   an institution and carries a **required, indexed `institutionId`**. The only
   platform-level account is the superadmin (`Operator`).

2. **WHITE-LABEL / SHADOW.** Students must NEVER learn Max Music School exists. On every
   institution panel (student, teacher, admin) the only brand shown is the **institution's**
   name + logo + color (`Institution.branding`). The string "Max Music School" appears on
   NONE of the institution panels, emails, or URLs. The operator panel lives on a separate,
   private domain that students are never given a link to.

3. **PBAC, ONE CREDENTIAL.** The institution admin is NOT a separate account. It is the
   owner `Teacher` whose `panelAccess` array includes `'admin'`. The same email+password
   that opens the teacher panel opens the admin panel once granted. Granting/revoking admin
   is a single superadmin button — no new credentials, no re-provisioning email.

4. **THE GOLDEN RULE — DATA ISOLATION.** Every query under `/api/inst/:slug/*` MUST be
   filtered by the `institutionId` resolved from the slug. The ONLY place cross-institution
   queries are allowed is under `/api/operator/*` (superadmin god-mode).

5. **AUDIT EVERYTHING.** Every write (create/update/delete) in every route calls
   `auditLog()`. One immutable `AuditLog` collection powers BOTH the superadmin "Changes
   History" tab and the per-student activity feed (same data, filtered by entity).

---

## TECH STACK (do not substitute)

```
Backend:     Node.js + Express + MongoDB (Mongoose, mongoose-paginate-v2)
Frontend:    Next.js 14 (App Router) — one app per panel
Monorepo:    Turborepo
Auth:        JWT in httpOnly cookies (never localStorage), PBAC panelAccess
File Upload: AWS S3 (pre-signed URLs)
Email:       Nodemailer (branded per-institution sender)
Payments:    Razorpay — per-teacher payment links; app TRACKS money, does not ROUTE it
Real-time:   Socket.io (live attendance, class status) — rooms keyed by institutionId
Scheduler:   node-cron (daily student-status / validity transitions)
Infra:       Single VPS · Nginx reverse proxy · PM2
```

---

## THE FOUR PANELS (apps)

| App | Used by | URL pattern | Port |
|---|---|---|---|
| `operator-panel` | the client (superadmin) | `https://<OPERATOR_DOMAIN>/` (private) | 3000 |
| `institution-admin-panel` | owner-teacher (autonomous) **or** superadmin (impersonating) | `https://<PLATFORM_DOMAIN>/<slug>/admin` | 3001 |
| `institution-teacher-panel` | each teacher in an institution | `https://<PLATFORM_DOMAIN>/<slug>/teacher` | 3002 |
| `institution-student-panel` | each student | `https://<PLATFORM_DOMAIN>/<slug>/student` | 3003 |
| `api` | — | `https://api.<PLATFORM_DOMAIN>/` | 4000 |

- `<PLATFORM_DOMAIN>` = a **neutral** white-label domain (NOT "maxmusic"). Final value is a
  deploy config; never hardcode it — use env vars.
- `<OPERATOR_DOMAIN>` = a separate private domain for the superadmin only.
- `:slug` = institution's immutable URL-safe id (e.g. `abc-music-school`). It leads the path
  so the URL reads as the teacher's school. **Slug is immutable after creation.**

---

## API NAMESPACING

```
/api/auth/operator/{login,logout,me,verify-2fa}     → superadmin auth
/api/operator/*                                      → superadmin god-mode (cross-institution)
/api/inst/:slug/auth/{admin,teacher,student}/login   → institution logins
/api/inst/:slug/admin/*                              → institution admin (the 8 tabs)
/api/inst/:slug/teacher/*                            → institution teacher
/api/inst/:slug/student/*                            → institution student
```

Cookies (httpOnly, secure, sameSite): `operator_token`, `inst_admin_token`,
`inst_teacher_token`, `inst_student_token`. Institution cookies are **path-scoped** to
`/api/inst/:slug` so one school's cookie is never sent to another's routes.

---

## MIDDLEWARE CHAINS

```
operator route:     operatorAuth → controller
inst admin route:   resolveInstitution → instAuth('admin')   → scopeGuard → panelGuard('admin') → controller
inst teacher route: resolveInstitution → instAuth('teacher') → scopeGuard → controller
inst student route: resolveInstitution → instAuth('student') → scopeGuard → controller
```

- **resolveInstitution** — `:slug` → Institution doc (cached, TTL 5 min). Unknown slug → 404
  (never confirm a slug exists). Suspended/terminated → 403. Sets `req.institution`.
- **instAuth(panel)** — verifies the cookie JWT; checks BOTH
  `token.instVersion === institution.tokenVersion` AND `token.userVersion === user.tokenVersion`
  (two-level invalidation); checks `user.panelAccess` includes `panel`; sets `req.actor`.
- **scopeGuard** — `req.actor.institutionId === req.institution._id`, else 403. Superadmin
  god-token bypasses.
- **panelGuard('admin')** — PBAC: actor's grant must include `admin` for this institution.
  Superadmin god-token bypasses.
- **God-mode / impersonation** — a short-lived operator-issued token is accepted by
  `instAuth`, bypasses scopeGuard + panelGuard, and stamps `actorRole: 'superadmin'` +
  `impersonatedBy` on every audit entry.

---

## TOKEN INVALIDATION (two levels)
- `Institution.tokenVersion` — bump on **suspend** or **mode toggle** → logs out the whole institution.
- `Teacher.tokenVersion` / `Student.tokenVersion` — bump on **grant/revoke access** or password reset → logs out that one user only.

---

## AUDIT LOG RULE

```
auditLog({
  institutionId,                       // required — every operational write is scoped
  actorId, actorRole, actorName,       // role ∈ superadmin|institution_admin|teacher|student|system
  impersonatedBy,                      // operatorId when superadmin acted via god-token, else null
  action,                              // 'CREATE_STUDENT', 'UPDATE_PAID_AMOUNT', 'TOGGLE_MODE'…
  entityType, entityId, entityLabel,   // label denormalized: "Student: Arti Thakur"
  changes,                             // [{field, from, to}] → renders "PAID AMOUNT changed from 0 to 6000"
  before, after,                       // optional full snapshot, sensitive fields stripped
  ip,
})
```
- Uses `{ w: 0 }` write concern — NEVER blocks the main operation.
- Strip `password`, `passwordHash`, `jwt_token`, `recoveryOtp`, `otp` before logging.
- Immutable: never updated or deleted.

---

## STANDARD RESPONSE FORMAT

All responses via `Helper.response()` — never bare `res.json()`.
```
{ success: true|false, message: "...", data: {...} | null }
```
List endpoints: `data: { items: [...], pagination: { page, limit, total, pages } }`.
Never expose `err.message`/stack traces. Never return `password`/`passwordHash`/`recoveryOtp`.

---

## KEY DOMAIN RULES (from the current product)

- **Enrollment is two-step:** Add Student → `EnrollmentRequest` (PENDING + UNPAID) →
  admin approves → `Student` created.
- **Fee is per-student:** `paidAmount`, `upcomingAmount`, validity window (e.g. 60d),
  `paidClasses`. Set **manually** by admin; Razorpay webhook feed is a read-only
  reconciliation list. The amount a teacher charges is visible on operator + admin panels.
- **Suitable Days** (reusable day-patterns) + **Suitable Times** (reusable time-windows)
  compose into **Batches** (batch = instrument + day-pattern + time-slot + optional teacher).
- **One batch per student** (MVP). Batch with no teacher = "Setting Phase".
- **Student lifecycle** (`joinStatus`: trial → active_soon → active → inactive) is advanced
  by a **daily cron** (matches "changed BY SYSTEM"); validity expiry auto-sets inactive.
- **Holidays** credit a class back to students (regular/trial category) for a batch on a date.

---

## WHAT NOT TO DO (HARD RULES)

**Security & isolation:**
- Never skip the `institutionId` filter under `/api/inst/:slug/*`.
- Never use localStorage for tokens — httpOnly cookies only.
- Never allow slug updates after creation.
- Never write a synchronous audit log that could block the response.
- Never expose stack traces; never return password/hash/otp fields.
- Operator login requires 2FA (TOTP).

**White-label:**
- Never render "Max Music School", its logo, or `<OPERATOR_DOMAIN>` on ANY institution panel, email, or URL.
- Never hardcode domains/API URLs — always env (`NEXT_PUBLIC_API_URL`, `PLATFORM_DOMAIN`).

**Architecture:**
- Business logic in controllers only; auth logic in middleware only; routes only wire them.
- One MongoDB connection — tenant separation is the `institutionId` field, not per-tenant DBs.
- All responses via `Helper.response()`; all list endpoints paginate.

**Frontend (design system — see orchestrate/agents/frontend-agent.md):**
- Brand accent is **Steel Blue `#5B8DEF`** for the operator panel; institution panels use
  the institution's own `branding.primaryColor`. NO pink anywhere.
- `motion/react` (not framer-motion); `radix-ui` (not @radix-ui/react-slot); lucide-react;
  tailwindcss v4; sonner; next-themes. Every section entrance animated (`<BlurFade>`).

**Self-check after every institution controller:**
```
grep -nE "\.find|\.findOne|\.findOneAndUpdate|\.updateMany|\.deleteOne|\.aggregate" [file] | grep -v institutionId
```
Any line that touches data without `institutionId` (outside `/operator/*`) = security bug. Fix before ✅.

---

## IMPLEMENTATION PHASES (see orchestrate/tasks.md for the live board)
```
Phase 0 — Monorepo scaffold (4 apps + 3 packages), Nginx path routing, PM2
Phase 1 — Mongoose models (core MVP set) + shared types
Phase 2 — Auth + PBAC middleware (operator 2FA, instAuth, scopeGuard, panelGuard, impersonation)
Phase 3 — Operator (SaaS) APIs: institutions CRUD, grant/revoke admin, cross-inst views, impersonation
Phase 4 — Institution APIs: admin (8 tabs), teacher, student
Phase 5 — Operator panel frontend
Phase 6 — Institution panels frontend (admin, teacher, student) + white-label theming
Phase 7 — Payments (Razorpay webhook + reconciliation), daily cron, branded emails
Phase 8 — QA, security audit (isolation + white-label leak check), deploy
```

## GSTACK — see GSTACK.md
`/cso` is mandatory after Phase 2 (auth/PBAC) and Phase 4 (institution isolation).
`/qa` after Phase 5 and Phase 6 (and verify NO Max Music leakage on institution panels).
