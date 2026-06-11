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

### Open findings — status after the 2026-06-11 full E2E `/qa` (see §7)

- ✅ **FIXED — P2 DayPattern unique multikey index** → derived `daysKey` + unique
  `{institutionId, daysKey}`; live DB migrated via `scripts/migrate-daypattern-dayskey.js` (`ca0b244`).
- ✅ **FIXED — P2 Input hydration mismatch** → React 18 `useId()`; browser-verified zero
  hydration warnings (`85e2b47`).
- **P3 — ClassSession** `models/ClassSession.js:28` may lack a `{institutionId, targetDate}` index (verify vs queries).
- **P3 — `ref is not a prop`** console warning — traced to `packages/ui` `BlurFade` →
  framer-motion `AnimatePresence/PopChild`; fix planned in the E2E close-out (ISSUE-001).
- **P3 — `@maxmusic` npm scope** appears in client bundle module paths (not the brand, not rendered — rename only for maximal white-label paranoia).
- **INFO — god-token path** (`middleware/instAuth.js:73`) doesn't re-check `operator.tokenVersion`; a deactivated operator's outstanding god token stays valid until its 15-min TTL.

---

## 7. FULL E2E `/qa` — LIVE-MODE CONTRACT BUGS (2026-06-11) ✅ COMPLETE (all 4 panels; 19 issues fixed)

> Exhaustive browser click-through of every tab/workflow against the LIVE stack, driven by
> `documentation/feature-inventory/`. Full narrative + evidence: `documentation/qa-e2e-2026-06-11.md`.
> **Theme of every finding: the frontend was built against mock shapes; live API shapes/routes drifted.**
> Prior audits were source-only or login-depth — these only surface when every workflow runs live.

**Operator panel — 6 bugs found, fixed (one commit each), and browser re-verified:**
| ID | Sev | Bug → fix |
|---|---|---|
| ISSUE-002 | critical | dashboard crash: unguarded `item.changes.length` on live audit items (5 consumers guarded) — `e1433ca` |
| ISSUE-003 | high | fee chart rendered `MOCK_FEE_TREND` in live mode → real `revenue.feeTrend` aggregation — `93d5b12` |
| ISSUE-004 | high | list filters sent `'all'` sentinel; 4 controllers filtered on the literal → 0 rows — `504d72a` |
| ISSUE-005 | critical | institution detail crash: live `{institution}` envelope vs bare mock shape — `5fddb67` |
| ISSUE-006 | critical | Settings crash + phantom 2FA endpoints → defaultRent persisted on Operator; full settings payload; one-step mandatory-2FA card — `5567ba6` |
| ISSUE-007 | high | god-mode edit modals PATCHed routes that didn't exist → implemented audited `PATCH /operator/{students,teachers}/:id` — `cfc8c06` |

Verified workflows: TOTP login · create institution · grant-admin (scenario 3) · suspend/reactivate ·
god-mode student edit (audit + activity rail) · default-rent save round-trip · all 9 tabs render with live data.
Remaining: student panel phase + /qa close-out (operator/admin/teacher done; ISSUE-001 fixed; see qa-e2e doc §Remaining).

**Merge note (`4afb761`):** Dev B PR #3 landed mid-QA and had independently fixed BUG-01, ISSUE-004,
ISSUE-006 and ISSUE-007 in parallel. Conflicts in 11 files resolved keeping the live-DB-compatible
`daysKey` (ours), adopting their `PlatformSettings` + two-step 2FA settings design (supersedes the
ISSUE-006 one-step card; Operator.defaultRent field removed) and their `update`/god-mode-create
controllers with our stricter validations + teacher tokenVersion-on-deactivate security graft.
ISSUE-006/007 rows above describe the pre-merge fixes; the post-merge contract is the PR #3 shape.
Full table: `documentation/qa-e2e-2026-06-11.md` §merge.

### Admin panel phase (post-merge, 2026-06-11) — 4 live-mode contract bugs, all fixed + re-verified
| Issue | Sev | Bug | Commit |
|---|---|---|---|
| ISSUE-008 | high | Setting-Phase batch had no UI to assign a teacher → could never go Active (backend PATCH existed, no caller). Added assign-teacher modal to batch console. | `cba3be9` |
| ISSUE-009 | critical | New-request created an optimistic row with a fabricated `_id`; approve/reject posted it → CastError 500. No enrollment approvable live. Now uses the persisted request. | `30a2df7` |
| ISSUE-010 | high | Student edit resolved `instrumentId` from `MOCK_INSTRUMENTS` → live PATCH sent a mock id → refGuard `STUDENT_BAD_REFS` 400. No edit could save. Now loads the real `/instruments` catalog. | `e332559` |
| ISSUE-011 | high | Attendance month-grid `cycleCell` was local-state only — corrections never hit the API, lost on reload. Now POSTs `/attendance/mark` (present/absent) optimistically. | `7daa4d1` |
| ISSUE-012 | low | One transient React "argument changed size between renders" warning (dev-only, didn't recur). Not root-caused; logged. | ✅ CLOSED in teacher phase — not reproduced; console clean on fresh load |

Admin workflows verified clean (no fix): suitable-days (BUG-01 UI re-verify + dup-reject), suitable-times
(create + end-before-start validation + toggle), batch create/launch-session, add teacher, request→approve→student
(+temp password), add-student dialog, student detail/activity/edit, holiday declare/remove (credit reversal),
manual fee entry + reconciliation, branding edit (→ public `/branding`), slug-change request (→ pending, operator
queue), impersonation banner (white-label clean), white-label sweep all 10 pages. **Same lesson as the operator
phase: mock-built frontend drifted from the live API — only live click-through of every write catches it.**

**Environment note:** an unaudited bulk demo dataset (30 `STU-10NN` students + teachers/batches)
appeared in `demo-school` via direct DB write during the session — no repo code generates it;
likely another machine/process on the same Atlas dev DB. Rotate dev `MONGO_URI` if unexpected.

### Teacher panel phase (2026-06-11) — 3 live-mode bugs, all fixed + re-verified
Tested as QA Guitar Teacher (100003, mobile 7777777777) since the owner teacher has no batches.
Verified live: login/sign-out, dashboard, My Batches, batch detail (overview/attendance/students),
**attendance mark→save→DB persist + `MARK_ATTENDANCE` audit + Socket.io re-fetch round-trip**,
**Teachers roster + live KPI** (`config/teacherKpi.js` — non-zero only for the teacher with a
batch+attendance), teacher detail/relaunch, **profile edit** (persist + `UPDATE_TEACHER_PROFILE`
diff + revert), **holiday declare/remove** (`CREATE_/DELETE_HOLIDAY` audit; trial student correctly
not credited by a regular-category holiday). White-label clean throughout.
| Issue | Sev | Bug | Commit |
|---|---|---|---|
| ISSUE-013 | high | Dashboard holiday tile "Invalid Date NaN" — `${h.date}T00:00:00` assumed bare `YYYY-MM-DD`, live API returns full ISO. Now `String(h.date).slice(0,10)`. | `73766df` |
| ISSUE-014 | low | Roster row `<Link>` (`<a>`) wrapped mailto:/tel: `<a>` → invalid nested anchors. Inner anchors → `<button>`. | `2d24e16` |
| ISSUE-001 | low | `BlurFade` `ref is not a prop` on **every page of all 4 panels** (shared `packages/ui`) — dead AnimatePresence/exit. Removed. Closes BUG-04; teacher console now clean on fresh load. | `41a8634` |

**Same drift lesson again** (ISSUE-013): the frontend assumed the mock date shape; the live API
sent full ISO. ISSUE-001/014 are HTML/animation correctness, not isolation/audit/white-label.

### Student panel phase (2026-06-11) — 4 bugs, all fixed + re-verified
Tested with seeded student 106001 (no batch → empty states) and enrolled student 106002 (mobile
6666666666, Guitar Mon-Wed batch, 2 attendance records → data-rich views). Verified live: login/
sign-out, **dashboard** ("YOUR NEXT CLASS … 15 Jun 2026 · IN 4 DAYS", attendance 100% 2/2, validity),
**My Classes** (2 PRESENT sessions), **Timetable** (weekly grid Mon 8 + Wed 10), **Payments** (empty
reconciliation feed — correct), **Profile** (guardian edit → 200 + `UPDATE_STUDENT_PROFILE` audit +
revert). White-label clean all 5 pages; clean console on fresh load.
| Issue | Sev | Bug | Commit |
|---|---|---|---|
| ISSUE-015 | critical | `GET /student/classes` 500 — `Attendance.paginate` undefined; model never registered `mongoose-paginate-v2`. Now `.plugin(mongoosePaginate)`. | `8f07b64` |
| ISSUE-016 | critical | `/timetable` returned `{timetable:[{day}]}`, contract is bare `ClassItem[]` w/ `date` → "object not iterable" crash. Backend now emits dated 6-week sessions (holidays + attendance folded). | `e638cff` |
| ISSUE-017 | critical | dashboard `upcomingClass` lacked `date` (+ `holidayNotice` was an object) → `relativeDay(undefined)` crash. Now a `ClassItem` + string notice. | `e638cff` |
| ISSUE-018 | high | student profile Save → 404; `PATCH /student/me` route + controller never built. Implemented `updateMe` (email + guardian, audited) + model fields + route. | `cbd6a38` |

ISSUE-015/018 are genuine **backend gaps** (missing plugin; un-built contract route); 016/017 are the
same contract drift, but the live API violated `CONTRACTS.md` so the fix was backend-side.

---

## FULL E2E `/qa` — FINAL VERDICT (2026-06-11): ✅ COMPLETE, all 4 panels
**19 issues found + fixed + browser-re-verified** across operator (6: ISSUE-002..007), admin (4:
ISSUE-008..011), teacher (3: ISSUE-013/014/001), student (4: ISSUE-015..018), plus the 2 pre-phase P2s
(BUG-01/02); **ISSUE-012 closed (not reproduced)**. Every tab/workflow/write exercised live in the
browser. Data isolation, audit logging (correct actor + diff on every write), white-label (zero "Max
Music" at runtime), PBAC, operator 2FA, and Socket.io live attendance all verified clean; console is
warning-free on fresh loads. Dominant root cause across all panels: **mock-built frontend vs drifted
live API** (envelopes, missing routes/fields, sentinels, mock ids, ISO-vs-bare dates). Full narrative:
`documentation/qa-e2e-2026-06-11.md` §FINAL VERDICT. Remaining (non-QA): `/ship` (HELD) → VPS deploy.

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
