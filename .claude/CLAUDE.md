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

## ACTIVE DEVELOPER ROLE

**The Dev A / Dev B split is DISSOLVED.** Dev B has delivered everything in his lane (all 4
panels + the admin-renovation supporting APIs, merged via PR #2). We are now **one team
finishing the whole project** — backend, frontend, infra, QA, and deploy are all in scope.
History of the old split is in `team-division.md` (reference only).

> **Full end-to-end audit (2026-06-10): ✅ PASS** — see `AUDIT.md` for the dimension-by-
> dimension verdict and the **roadmap of what's left (L1–L13)** to finish the project. No
> isolation/audit/white-label/compile errors were found across the whole codebase; the only
> fix was untracking two stray `*.tsbuildinfo` build artifacts.

> **Live wiring (2026-06-10): ✅ L1–L3 DONE** — real MongoDB Atlas connected; all 4 panels
> leave mock mode. Specifics: (1) repo-root `.env` created (MONGO_URI, 6 JWT secrets, localhost
> domains, stubbed SMTP); (2) `server.js` — dotenv loads root `.env` by absolute path so it
> resolves under turbo/nodemon's `apps/api` cwd; CORS allows `localhost:3000–3003` in dev;
> (3) `scripts/seed.js` — fixed 3 schema mismatches (instruments are per-institution, institution
> needs `createdByOperatorId`, operator id threaded through); (4) 4 × `.env.local` set
> `NEXT_PUBLIC_API_URL=http://localhost:4000`; smoke-tested: `/health` ✅, branding (white-label)
> ✅, unknown-slug 404 ✅, teacher login → cookie + JWT ✅. Seeded: Operator `admin@maxmusic.internal`
> / TOTP secret `HQWBOILHHMGEO7TA`; demo inst slug `demo-music-school`; owner teacher mobile
> `9999999999`. Run stack: `npm run dev` from repo root.

> **Deploy + login verification (2026-06-11): ✅ L4 + L7 DONE.** All 5 processes brought up locally
> and every panel login verified working end-to-end. Specifics: (1) **SWC binary fix** — root
> `package.json` optionalDependency `@next/swc-win32-x64-msvc` must be `14.2.33` (NOT 14.2.35 — that
> version does not exist on npm; `next@14.2.35` itself pins the swc binary to 14.2.33). Next's
> lockfile auto-patch (`patch-incorrect-lockfile.js`) crashed looking up `versions["14.2.35"]` on the
> swc pkg. Fix = pin 14.2.33 + run every `next dev` with env `NEXT_IGNORE_INCORRECT_LOCKFILE=1`.
> (2) **Local run procedure (Windows):** do NOT use `npm run dev` (turbo) — turbo aborts ALL panels
> if one fails and doesn't reliably pass the env var. Start the 5 processes independently: API =
> `cd apps/api && npm run dev` (port 4000); each panel = `cd apps/<panel> && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p <port>` (3000/3001/3002/3003). PowerShell is unavailable on this box — use Bash.
> (3) **Dev credentials set + verified** via `scripts/dev-credentials.js` (resets known passwords on
> the seeded accounts, grants the owner-teacher `panelAccess:['teacher','admin']`, creates one active
> demo student) and `scripts/verify-logins.js` (hits the live API; all 4 logins PASS incl. a live TOTP
> code for operator 2FA). Working creds: OPERATOR `admin@maxmusic.internal` / `Operator@123` + TOTP
> `HQWBOILHHMGEO7TA`; ADMIN (email) `teacher@demo.internal` / `Teacher@123`; TEACHER (mobile)
> `9999999999` / `Teacher@123`; STUDENT (mobile) `8888888888` / `Student@123`. (4) **Browser-verified**
> via gstack `/browse`: operator login + 6-digit TOTP 2FA → `/dashboard` works; all 3 institution login
> pages render the institution brand "Demo Music School" only (zero "Max Music"/"maxmusic" at runtime).

> **Full gstack pipeline re-run (2026-06-11): ✅ all 6 prescribed runs PASS.** Ran in plan order:
> `/plan-eng-review` (18 models), `/cso` (middleware), `/review` (9 operator controllers), `/cso`
> (14 institution controllers), `/qa` ×2 (operator + institution panels, browser). **Isolation, audit,
> white-label, secret-leakage, PBAC, 2FA all CLEAN.** `/ship` intentionally HELD (user decision — nothing
> pushed, no code changed). **Two real P2 findings remain open** (see `AUDIT.md §6` + memory
> `project_gstack_review_findings`): (a) **DayPattern** `models/DayPattern.js:38` `index({institutionId,days},{unique})`
> is a MULTIKEY unique index (days is an array) → two patterns sharing any one day collide on E11000;
> intent is unique day-SET, fix with a derived sorted `daysKey` + unique `{institutionId,daysKey}`.
> (b) **Input hydration** `packages/ui/src/components/form/input.tsx:15` uses a module-level counter
> (`mm-input-${++inputAutoId}`) that diverges server (process-singleton) vs client → React hydration
> mismatch on EVERY form across all 4 panels; fix with React 18 `useId()`. Lower: P3 ClassSession may
> lack `{institutionId,targetDate}` index; INFO god-token path doesn't re-check `operator.tokenVersion`
> (15-min window); P3 `@maxmusic` npm scope appears in client bundle module paths (not the brand, not
> rendered). **Next: fix the 2 P2s, then /qa full 3-scenario E2E (L8), then /ship + VPS deploy (L9–L13).**

**H1 + H2 complete** — scaffold + 16 models + `packages/types` ready. **P1-R /plan-eng-review ✅** (5 model fixes). **P2-R /cso ✅** — 5 checkpoint Qs clean; .gitignore + lockfile + nodemailer@8 + node-cron@4 fixed. **Phase 3 (Operator APIs) ✅** — 9 controllers + 29 routes behind `operatorAuth`. **P3-R /review ✅** — 5 fixes (existingTeacher isolation guard, grant/revoke idempotency = no mass-logout, impersonate targetUserId required, audit accuracy). **Phase 4 (Institution APIs) ✅** — 10 controllers + 46 routes under `/api/inst/:slug/*`; every login JWT embeds `instVersion`+`userVersion`; brandingPublic-only (white-label). **P4-R /cso ✅** — 1 HIGH fixed (`config/refGuard.studentRefsValid` rejects cross-institution teacher/batch/instrument refs in student create/patch + request approve — they leaked foreign labels via populate); other 4 checkpoint Qs clean. **BACKEND COMPLETE (Phases 0-4).** **Frontend integration (current session) ✅** — Dev B's 4-panel frontend merged (PR #1). Dev A pass over it: (1) **H2 type migration** — all 4 apps now import the shared contract (`ApiResponse`/`Paginated`/`BrandingPublic` + enums) from `@maxmusic/types` instead of local mirrors (drift eliminated); (2) **`[slug]` routing fix** — the 3 institution panels were flat route-groups (`/dashboard`) that 404 behind nginx; restructured to real `app/[slug]/<panel>/(auth|dashboard)/*` with slug-aware nav, validated by `next build` ×4; (3) **multi-tenant slug fixes** — 401-redirect now `/<slug>/<panel>/login` (was hardcoded `/login`), teacher panel now derives slug from the URL (was a build-time `NEXT_PUBLIC_INSTITUTION_SLUG` env var = one-slug-per-build); (4) **new public `GET /api/inst/:slug/branding`** endpoint (controller + route + CONTRACTS) wired into all 3 login pages — clears the teacher TODO(H5) + student BLOCKED notes. **Phase 7 backend (current session) ✅** — (1) **Socket.io** (`config/socket.js`) shares the HTTP server, rooms keyed by institutionId; auth via a short-lived `JWT_SECRET_SOCKET` token minted by `GET /:slug/{admin,teacher}/realtime-token` (panel cookies are path-scoped so they can't reach `/socket.io`); room derives from the VERIFIED token only; `emitToInstitution` (already called by teacher `markAttendance`) now live → unblocks teacher `TODO(H3)` backend-side. (2) **Daily cron** (`config/cron.js`, 00:05 `CRON_TZ`) advances `active_soon→active`, expires validity→inactive (both audited per-student as the `system` actor), and flags overdue rent. (3) **Razorpay webhook** (`POST /api/webhooks/razorpay`, `WebhookController`) mounted pre-json with `express.raw`; timing-safe HMAC verify (fails closed), idempotent by paymentId+eventType, tenant from payload `notes`; read-only RazorpayWebhookEvent feed only. (4) **Branded mailer** (`config/mailer.js`) lazy transport, From-name = institution `branding.schoolName` (never "Max Music"), fails soft. All smoke-tested. Next: H4/H5 live wiring (`NEXT_PUBLIC_API_URL` + `/qa`); Dev B wires `TODO(H3)` client to realtime-token + Socket.io; then Phase 8 (QA + deploy).

> **Isolation lesson (P4-R):** scoping the `:id` lookup by `institutionId` is NOT enough — client-supplied foreign-key refs (`teacherId`/`batchId`/`instrumentId`) in create/patch bodies must ALSO be verified to belong to the institution before persist, or a foreign id leaks the other tenant's data through Mongoose `populate` (which has no tenant filter). Always run refs through `config/refGuard`.

> **Routing lesson (current session):** institution panels MUST use a real Next `[slug]` route segment (`app/[slug]/<panel>/...`), NOT flat route-groups — nginx preserves the `/<slug>/<panel>` prefix, so flat routes 404 and client-side nav silently drops the slug. The slug is read from the first path segment via `getInstSlug()` (works once `[slug]` exists); never a build-time env var (breaks the one-deployment-serves-all-institutions model).

The 3 implementation contracts from P2-R are now LIVE in code: (1) login JWTs embed `instVersion`+`userVersion` (via `config/instAuthHelpers.issuePanelCookie`); (2) grant/revoke/suspend/terminate bump `tokenVersion`; (3) every institution state change calls `invalidateInstitution(slug)`.

---

## TECH STACK (do not substitute)

```
Backend:     Node.js + Express + MongoDB (Mongoose, mongoose-paginate-v2)
Frontend:    Next.js 14 (App Router) — 4 separate apps, one per panel
Monorepo:    Turborepo (4 apps + 3 packages)
Auth:        JWT in httpOnly cookies (never localStorage), PBAC panelAccess
File Upload: AWS S3 (pre-signed URLs)
Email:       Nodemailer (branded per-institution sender)
Payments:    Razorpay — per-teacher payment links; app TRACKS money, does not ROUTE it
Real-time:   Socket.io (live attendance, class status) — rooms keyed by institutionId
Scheduler:   node-cron (daily student-status / validity transitions)
Infra:       Single VPS · Nginx reverse proxy · PM2 (5 processes: api + 4 panels)
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
/api/inst/:slug/branding                             → PUBLIC pre-auth white-label identity
/api/inst/:slug/auth/{admin,teacher,student}/login   → institution logins
/api/inst/:slug/admin/*                              → institution admin (the 8 tabs)
/api/inst/:slug/teacher/*                            → institution teacher
/api/inst/:slug/student/*                            → institution student
/api/inst/:slug/{admin,teacher}/realtime-token       → mints Socket.io handshake token
/api/webhooks/razorpay                               → PUBLIC Razorpay webhook (raw-body HMAC)
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
Phase 0 — Monorepo scaffold        ✅ DONE  [A: api + nginx + PM2 + env]  [B: 4 Next.js apps + packages/ui/utils — pending]
Phase 1 — Mongoose models + types  ✅ DONE  [A only]  (P1-R /plan-eng-review ✅)
Phase 2 — Auth + PBAC middleware   ✅ DONE  [A only]  (P2-R /cso ✅)
Phase 3 — Operator APIs            ✅ DONE  [A only]  (P3-R /review ✅)
Phase 4 — Institution APIs         ✅ DONE  [A only]  (P4-R /cso ✅) — BACKEND COMPLETE
Phase 5 — Operator panel frontend       ✅ built (+ Slug Requests queue)
Phase 6 — Institution panels frontend   ✅ built ([slug] routing) + admin panel RENOVATED (PR #2)
Phase 7 — Payments · cron · emails · Socket.io   ✅ backend DONE (mailer triggers wired — P7-04)
Full audit (2026-06-10)                  ✅ PASS — see AUDIT.md (no errors; tsbuildinfo untracked)
gstack pipeline re-run (2026-06-11)      ✅ all 6 PASS — eng-review, cso×2, review, qa×2; 2 open P2s (AUDIT.md §6)
Phase 8 — Finish: live wiring + QA + deploy
  L1 env (.env, 4×.env.local)            ✅ DONE (2026-06-10)
  L2 CORS + dotenv root-path fix         ✅ DONE (2026-06-10) — server.js
  L3 seed fixes + smoke tests            ✅ DONE (2026-06-10) — seed.js
  L4 browser QA all 4 panels             ✅ DONE (2026-06-11) — SWC fix; all 4 logins verified (API+browser)
  L5 Socket.io client TODO(H3)           ✅ DONE — teacher lib/socket.ts (realtime-token → socket rooms)
  L6 mailer trigger wiring               ✅ DONE — P7-04 (owner/teacher/student welcome + grant-admin)
  L7 operator 2FA live check             ✅ DONE (2026-06-11) — TOTP 2FA login → dashboard in browser
  L8 /qa E2E (3 onboarding scenarios)    ◑ PARTIAL — /qa ran (login+white-label verified); full 3-scenario E2E pending
  L9 /ship                               ⏸ HELD (user decision — not pushed)
  L10–L13 nginx/TLS/PM2/VPS deploy       ← pending (local deploy done; VPS not)
  OPEN BUGS                              2 × P2 — DayPattern multikey index · Input useId hydration (AUDIT.md §6)
```

Handoffs: H1 ✅ · H2 ✅ (packages/types exported — Dev B can wire typed responses) · H3 ✅ (Phase 2 done) · H4 ✅ (Phase 3 operator API contracts in CONTRACTS.md) · H5 ✅ (Phase 4 institution API contracts in CONTRACTS.md — Dev B can build all 4 panels) · H6 after Phase 7.

## GSTACK

Gstack skills are installed at `~/.claude/skills/gstack`. Full reference: `GSTACK.md`.

### Web browsing
Use `/browse` from gstack for ALL web browsing. **Never use `mcp__claude-in-chrome__*` tools.**

### Available skills
`/office-hours` · `/plan-ceo-review` · `/plan-eng-review` · `/plan-design-review` ·
`/design-consultation` · `/design-shotgun` · `/design-html` · `/review` · `/ship` ·
`/land-and-deploy` · `/canary` · `/benchmark` · `/browse` · `/connect-chrome` ·
`/qa` · `/qa-only` · `/design-review` · `/setup-browser-cookies` · `/setup-deploy` ·
`/setup-gbrain` · `/retro` · `/investigate` · `/document-release` · `/document-generate` ·
`/codex` · `/cso` · `/autoplan` · `/plan-devex-review` · `/devex-review` ·
`/careful` · `/freeze` · `/guard` · `/unfreeze` · `/gstack-upgrade` · `/learn`

### Mandatory checkpoints (see GSTACK.md for exact context to feed each skill)
`/cso` after Phase 2 (auth/PBAC) and Phase 4 (institution isolation) — non-negotiable.
`/qa` after Phase 5 and Phase 6 (verify NO Max Music leakage on institution panels).
