# MaxMusic Platform — Full End-to-End Audit

> **Audit date:** 2026-06-10 · **Auditor role:** senior engineer (whole-codebase pass)
> **Scope:** entire monorepo after Dev B's admin-panel renovation + supporting APIs (PR #2, `0150b90`).
> **Team model:** the Dev A / Dev B split is **dissolved** — one team now finishing the project.
> **Verdict:** ✅ **PASS.** No isolation, audit, white-label, or compile errors found. 1 hygiene fix applied.
> **Re-run (2026-06-11):** full gstack pipeline (eng-review + cso×2 + review + qa×2) re-run on the final codebase
> after live deploy — all 6 PASS; isolation/white-label confirmed at runtime in the browser. 2 open P2 bugs found
> (DayPattern multikey index · Input `useId` hydration) — see **§6**. `/ship` held by user decision.

This file is the single source of truth for *what is done* vs *what is left to finish the project*.
Living board: `orchestrate/tasks.md` · Architecture: `ARCHITECTURE.md` · API: `CONTRACTS.md`.

---

## 1. AUDIT VERDICT BY DIMENSION

| Dimension | Result | Evidence |
|---|---|---|
| **Data isolation (Golden Rule)** | ✅ Pass | Every query in all 14 institution controllers is scoped by `institutionId`. Ran the mandated self-check grep — every flagged line builds its filter/`$match` with `institutionId` on the prior line. The one `_id`-only update (AuthController login `lastLoginAt`) targets the already-authenticated user's globally-unique `_id`. |
| **Cross-tenant ref leak (refGuard)** | ✅ Pass | `RequestController.approve` runs `studentRefsValid`; `BatchController.create/patch` verify instrument/dayPattern/timeSlot/teacher belong to the institution before persist. |
| **Audit logging** | ✅ Pass | Every write (holiday declare/remove, session launch, attendance mark, batch/teacher/student/request CUD, branding update, slug request/approve/reject) calls `auditLog()` with `{w:0}`. `actorFromReq` correctly resolves operator → `superadmin`. |
| **White-label / shadow** | ✅ Pass | Zero "Max Music"/operator-domain strings rendered on any institution panel. All hits are backend comments or the operator-only TOTP issuer. Institution responses return `brandingPublic` only. |
| **Token storage** | ✅ Pass | No `localStorage`/`sessionStorage` token use anywhere; all four API clients are `credentials:"include"` httpOnly-cookie only. |
| **No hardcoded domains** | ✅ Pass | Base URL is `process.env.NEXT_PUBLIC_API_URL` only; slug derived from the URL via `getInstSlug()`; no literal external URLs in client code. |
| **Slug immutability** | ✅ Pass | Admin `updateBranding` rejects `slug`. The ONLY slug mutation is `operator/SlugRequestController.approve` (native-driver bypass + `tokenVersion` bump + cache-bust on both slugs). |
| **Compile / types** | ✅ Pass | All 4 panels `tsc --noEmit` clean; admin panel `next build` clean (full route tree incl. new suitable-days/suitable-times/`[slug]/admin`). API route tree loads with all exports + string constants present. |
| **Repo hygiene** | ⚠️ → ✅ Fixed | Two `*.tsbuildinfo` build artifacts were still tracked despite the ignore rule — untracked this audit. `.env` correctly ignored. |

---

## 2. WHAT IS DONE

### Backend — `apps/api` (complete)
- **Phases 0–4** (scaffold, 18 models, auth/PBAC middleware, operator APIs, institution APIs) — all reviewed previously (`/plan-eng-review`, `/cso` ×2, `/review`).
- **Phase 7** (Socket.io live attendance, daily cron, Razorpay webhook, branded mailer + realtime-token) — implemented + smoke-tested.
- **Admin-renovation supporting APIs** (Dev B, this audit's focus) — all verified clean:
  - `DashboardController` — stat cards, today's classes, 12-month enrollment trend, 30-day attendance health (all `$match`-scoped).
  - `HolidayController` — declare (single + `allBatches` idempotent fan-out) with per-category class credit; remove reverses the credit. Audited.
  - `SessionController` — launch a class session (validated http/https meeting URL) + paginated archive.
  - `AttendanceController` — batch grid over a date window, admin correction `mark` (per-student `belongs` check, emits `attendance:marked`), per-class roll-up summary.
  - `BatchController` — list/get/create/patch/students with full ref-guarding + name auto-encode + setting→active on teacher assign.
  - `SettingsController` — branding edit (hex/logo validation, cache-bust), S3 logo presign, slug-change request (immutability enforced).
  - `RequestController.approve` — full enrollment form (dates/classes/payment) → Student, temp password surfaced once, refGuard enforced.
  - `TeacherController` — list/create/patch with `panelAccess`/`isOwner` **forbidden** from admin; activity feeds (teacher + student) scoped + ownership-checked.
  - `operator/SlugRequestController` — list/approve/reject; approval is the single sanctioned slug change.
  - New models `ClassSession`, `SlugChangeRequest` — `institutionId`-indexed, paginate plugin.

### Frontend — 4 Next.js panels (built)
- **Operator panel** — institutions, students, teachers, payments, changes history, settings, **Slug Requests** queue.
- **Admin panel** — renovated: top nav, enrollment-growth + attendance-health charts, rich approve-request form, two-pane student/teacher edit with live activity rail, Suitable Days / Suitable Times consoles, School Profile (brand color/logo/slug-request), batch 4-tab console (Overview/Holiday/Attendance/Students), declare-holiday.
- **Teacher panel** — dashboard, batches, attendance, holidays, profile (slug-from-URL).
- **Student panel** — dashboard, classes, timetable, payments, profile.
- All share `@maxmusic/types`; all run in **mock mode** when `NEXT_PUBLIC_API_URL` is unset.

### Infra
- `nginx.conf` (path routing), `ecosystem.config.js` (PM2 ×5), `.env.example` (all secrets incl. socket/cron), `scripts/seed.js`.

---

## 3. WHAT IS LEFT (roadmap to finish the project)

> Ordered by what unblocks the most. None of these are *bugs* — they are remaining build/integration/QA work.

### A. Live integration (highest priority — currently everything is mock-mode)
- [ ] **L1 — Wire panels to the live API.** Set `NEXT_PUBLIC_API_URL` per panel, stand up MongoDB, run `scripts/seed.js`, and exercise each panel against the real backend. No end-to-end request has ever hit the API in a browser yet.
- [ ] **L2 — Teacher live-attendance client (`TODO(H3)`).** Backend is ready (`GET /:slug/teacher/realtime-token` → Socket.io `auth.token` → listen `attendance:marked`). The teacher panel still needs the client wiring.
- [ ] **L3 — Logo upload e2e.** `SettingsController.logoUploadUrl` presigns S3; needs real `AWS_S3_BUCKET` creds to verify the upload + data-URL fallback path.

### B. Feature completion / wiring gaps (transport exists, callers don't)
- [x] **L4 — Mailer triggers.** ✅ DONE (P7-04). `config/mailer.js` + `config/emailTemplates.js` wired: owner welcome (inst create), teacher welcome (teacher create), student welcome (request approve), grant-admin notice — all fail-soft, From-name = institution `schoolName`. Rent-reminder still optional.
- [ ] **L5 — Razorpay payment-link flow.** Webhook reconciliation feed is read-only and done; the per-teacher payment-link generation/tracking UX is minimal — confirm it matches the product intent (app *tracks*, never *routes*, money).
- [x] **L6 — Operator 2FA enforcement check.** ✅ DONE (2026-06-11). Browser-verified: operator login is 2-step, blocks on `verify-2fa`; a live 6-digit TOTP code (secret `HQWBOILHHMGEO7TA`) → `/dashboard`. `scripts/verify-logins.js` reproduces it headlessly.

### C. QA + security sign-off (Phase 8) — see §6 for the full re-run
- [◑] **L7 — `/qa` E2E** — `/qa` ran in the browser (operator login+2FA, all 3 institution login/dashboard renders, console scan). The full 3-scenario onboarding walk (salary / autonomous / salaried-goes-independent) is still pending.
- [x] **L8 — `/qa` white-label leak pass** ✅ DONE (2026-06-11). Source scan = zero brand strings (all hits are `@maxmusic/*` import specifiers); **runtime** browser check = all 3 institution panels render "Demo Music School" only, `hasMaxMusic=false`.
- [x] **L9 — `/cso` full isolation + auth pass** ✅ DONE (2026-06-11). Re-ran `/cso` on middleware AND all 14 institution controllers post-renovation — 0 cross-tenant leaks; every `$match`/filter leads with `institutionId`; belongs-checks gate every client-supplied foreign id.
- [ ] **L10 — Automated tests.** No test suite exists. At minimum: isolation invariant tests (a tenant-B token cannot read tenant-A data on every `/inst/:slug/*` route) + the slug-change/token-invalidation flow.

### D. Deploy (Phase 8)
- [◑] **Local deploy** ✅ DONE (2026-06-11) — all 5 processes up on :4000 + :3000-3003 against live Mongo Atlas; all 4 logins verified. (VPS deploy below still pending.)
- [ ] **L11 — nginx + TLS** finalized for `PLATFORM_DOMAIN` + private `OPERATOR_DOMAIN`.
- [ ] **L12 — PM2 ecosystem** final (5 processes) + production `.env` filled.
- [ ] **L13 — `/ship` / `/land-and-deploy`** to the VPS, then `/canary` post-deploy. (`/ship` currently HELD by user decision.)

---

## 6. GSTACK PIPELINE RE-RUN (2026-06-11)

> Full prescribed pipeline re-run on the now-final codebase, in plan order. Verdict: **all 6 PASS**;
> isolation / audit / white-label / PBAC / 2FA clean. 2 real P2 bugs found (fixable, independent, not yet fixed).

| # | Run | Scope | Verdict | Findings |
|---|---|---|---|---|
| 1 | `/plan-eng-review` | 18 models | ✅ PASS | P2 ×1, P3 ×1 |
| 2 | `/cso` | middleware (tenant isolation) | ✅ CLEAN | 0 (1 info) |
| 3 | `/review` | 9 operator controllers | ✅ CLEAN | 0 |
| 4 | `/cso` | 14 institution controllers | ✅ CLEAN | 0 |
| 5 | `/qa` | operator panel (browser) | ✅ PASS | login+2FA→dashboard works |
| 6 | `/qa` | institution panels (browser) | ✅ PASS | P2 ×1, P3 ×1 |

**Confirmed clean:** triple-layered tenant isolation (path-scoped cookies + `instAuth` institution match +
`scopeGuard`); every institution query leads with `institutionId`; client-supplied foreign ids belongs-checked
(`refGuard`/`ownBatch`/`loadSelf`) before use; operator controllers leak no secrets, audit every write incl.
`IMPERSONATE_START`, paginate every list; white-label clean at source AND runtime.

### Open findings (not yet fixed — `/ship` held)

- **P2 (conf 8) — DayPattern unique multikey index.** `apps/api/src/models/DayPattern.js:38`
  `index({ institutionId: 1, days: 1 }, { unique: true })` on the array field `days` is MULTIKEY-unique →
  two patterns in one institution sharing any single day (Mon-Wed-Fri then Mon-Thu) throw `E11000` on the
  second insert. Intent is unique day-SET. **Fix:** drop the unique multikey; add a derived sorted `daysKey`
  string field with a unique `{institutionId, daysKey}` index (or enforce set-uniqueness in the controller).
- **P2 (conf 9) — Input component hydration mismatch.** `packages/ui/src/components/form/input.tsx:15`
  `autoId.current = \`mm-input-${++inputAutoId}\`` uses a module-level counter that diverges server
  (process-singleton, keeps counting across requests) vs client (resets per load) → React `htmlFor did not
  match` hydration warning on EVERY form across all 4 panels (caught live in browser `/qa`). Functionally the
  forms still work. **Fix:** replace the counter with React 18 `useId()` (Next 14 supports it).
- **P3 — ClassSession** `models/ClassSession.js:28` may lack a `{institutionId, targetDate}` index (verify vs queries).
- **P3 — `ref is not a prop`** console warning from the same `@maxmusic/ui` package.
- **P3 — `@maxmusic` npm scope** appears in client bundle module paths (not the brand, not rendered — rename only for maximal white-label paranoia).
- **INFO — god-token path** (`middleware/instAuth.js:73`) doesn't re-check `operator.tokenVersion`; a deactivated operator's outstanding god token stays valid until its 15-min TTL.

---

## 4. FIXES APPLIED THIS AUDIT
1. **Untracked `*.tsbuildinfo` build artifacts** (`apps/institution-admin-panel`, `apps/operator-panel`) — they were committed before the `.gitignore` rule and kept reappearing as "modified" in every diff. `git rm --cached`.

No code changes were required — the audited code was correct.

---

## 5. VERIFICATION EVIDENCE
- API: `require()` of the full route tree (institution/operator/webhook/auth) succeeds; all destructured helper/audit/specialFunctions/s3/password exports present; all ~28 referenced `strings.*` constants present.
- Isolation grep (CLAUDE.md self-check) across `src/controllers/institution/**` — every match scoped.
- `tsc --noEmit` — admin ✅, teacher ✅, student ✅, operator ✅.
- `next build` (admin) — ✅ exit 0; 16 routes compiled. (The "Failed to patch lockfile" line is a benign Next monorepo post-build warning, not a failure.)
