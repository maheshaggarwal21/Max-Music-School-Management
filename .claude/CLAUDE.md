# MaxMusic School Platform — Master Memory
> Claude Code reads this file at the start of EVERY session, before touching anything.
> Every agent, every sub-session, every task — read this first.
> Full reference: ARCHITECTURE.md · Schemas: orchestrate/data-model.md · API: CONTRACTS.md · Board: orchestrate/tasks.md

---

## WORKING PRACTICES

- **COMPULSORY — per-todo discipline (2026-06-12):** After completing EACH todo/phase, (1) update the
  relevant `.claude/` files and memory **first**, then (2) run `/compact`, THEN move to the next todo.
  Never batch documentation to the end and never advance to the next todo before the doc+compact step.
- **COMPULSORY — clean up processes (2026-06-12):** When the work is complete (or a task that started
  servers/background jobs ends), KILL every terminal process and background task you launched —
  dev servers (ports 4000 + 3000–3003), `run_in_background` Bash tasks, watchers. Leftover next-dev
  zombies serve hung responses and OOM the 7.5 GB box. Verify nothing is left listening before ending.
- **Context compaction:** After any heavy task (full QA pass, multi-file fix session, long doc update) — update `.claude/` files and memory **first**, then run `/compact`, then continue. Never let `/compact` fire before the documentation step or the work is lost to the next session.

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

> **Full E2E /qa (2026-06-11, IN PROGRESS): both P2s FIXED + operator panel phase COMPLETE.**
> Feature inventory of every tab/clickable/workflow in all 4 panels: `documentation/feature-inventory/`.
> BUG-01 fixed via derived `daysKey` + unique `{institutionId,daysKey}` and live-DB migration
> (`scripts/migrate-daypattern-dayskey.js`, commit `ca0b244`); BUG-02 fixed via React 18 `useId()`
> (`85e2b47`, browser-verified zero hydration warnings). Operator panel: every tab + workflow exercised
> live in the browser; **6 live-mode contract bugs found, fixed (one commit each), re-verified** —
> ISSUE-002 unguarded `item.changes` crash (5 consumers); ISSUE-003 fee chart rendered MOCK data in
> live mode → real `revenue.feeTrend` aggregation; ISSUE-004 list filters treated the `'all'` sentinel
> as a literal (4 controllers); ISSUE-005 detail page didn't unwrap the `{institution}` envelope;
> ISSUE-006 Settings crash + phantom 2FA endpoints → `defaultRent` persisted on Operator, full settings
> payload, one-step mandatory-2FA card; ISSUE-007 `PATCH /operator/{students,teachers}/:id` didn't exist →
> implemented with audited per-field diffs. Pattern: **frontend built on mock shapes, live API drifted —
> only live click-through catches these.** Details: `AUDIT.md §7` + `documentation/qa-e2e-2026-06-11.md`.
> **Constraint:** the box runs ONE panel dev-server at a time (7.5 GB RAM; 4 at once OOM-killed one) —
> QA is panel-by-panel. **Before starting the stack, kill EVERY process on ports 4000 + 3000–3003**
> (stale next-dev zombies serve hung responses): `netstat -ano | grep :PORT` → `taskkill //F //PID`.
> Remaining: admin → teacher → student phases, ISSUE-001 (BlurFade `ref` warning),
> impersonation banner, final report.

> **Admin panel E2E phase (2026-06-11, post-merge): ✅ COMPLETE — 4 contract bugs fixed.**
> Every admin tab + workflow exercised live in the browser on the merged code. **4 live-mode
> contract bugs found, fixed (one commit each), browser re-verified:** ISSUE-008 (`cba3be9`) a
> Setting-Phase batch had no UI to assign a teacher → could never go Active (backend PATCH existed,
> no caller); ISSUE-009 (`30a2df7`) new-request inserted a fabricated `req_local_<ts>` id → approve
> posted it → CastError 500, no enrollment approvable live; ISSUE-010 (`e332559`) student edit
> resolved `instrumentId` from `MOCK_INSTRUMENTS` → live PATCH sent a mock id → refGuard
> `STUDENT_BAD_REFS` 400, no edit could save; ISSUE-011 (`7daa4d1`) attendance month-grid corrections
> were local-state only, never persisted. Verified clean (no fix): suitable-days (BUG-01 UI re-verify +
> dup-reject), suitable-times (+ end-before-start validation), batch create/launch-session,
> add-teacher, request→approve→student (+temp password), add-student dialog, student detail/activity,
> holiday declare/remove (credit reversal), manual fee entry + reconciliation, branding edit (→ public
> `/branding`), slug-change request (→ pending, operator queue), impersonation banner (white-label
> clean), white-label sweep all 10 pages. ISSUE-012 (low, dev-only) a transient hooks deps-size
> warning — didn't recur, logged. **Same drift lesson: mock-built frontend vs live API.** Remaining:
> teacher panel (booted), student panel, ISSUE-001/012. Details: `documentation/qa-e2e-2026-06-11.md`.

> **Teacher panel E2E phase (2026-06-11): ✅ COMPLETE — 3 bugs fixed + console now clean.**
> Tested as QA Guitar Teacher (100003, mobile `7777777777`/`Teacher@123`) — the owner teacher (100001)
> has no batches; the guitar teacher owns the one batch + trial student. Verified live: login/sign-out,
> dashboard, My Batches, batch detail (overview/launch-archive/attendance/students), **attendance one-tap
> mark→save→DB persist + `MARK_ATTENDANCE` audit + Socket.io `attendance:marked` re-fetch round-trip**
> (realtime-token handshake fired), **Teachers roster + live KPI** (`config/teacherKpi.js` — 0.7/14% only
> for the teacher with a batch+attendance, 0 for the rest = engine is live), teacher detail/relaunch,
> **profile edit** (persist + `UPDATE_TEACHER_PROFILE` diff + revert), **holiday declare/remove**
> (`CREATE_/DELETE_HOLIDAY` audit; trial student correctly NOT credited by a regular-category holiday).
> White-label clean throughout. **3 live-mode bugs found, fixed (one commit each), browser re-verified:**
> ISSUE-013 (`73766df`) dashboard holiday tile rendered "Invalid Date NaN" — `${h.date}T00:00:00` assumed
> the bare mock date but the live API returns full ISO → `String(h.date).slice(0,10)`; ISSUE-014 (`2d24e16`)
> roster row `<Link>` (`<a>`) wrapped mailto:/tel: `<a>` → invalid nested anchors → inner anchors became
> `<button>`; **ISSUE-001 (`41a8634`) the BlurFade `ref is not a prop` warning on EVERY page of ALL 4
> panels** — dead `AnimatePresence`/`exit` around an always-mounted motion.div → removed; teacher console
> now warning-free on a fresh load (**also closes BUG-04**). **ISSUE-012 CLOSED** — not reproduced; the
> transient warnings were Fast-Refresh/dev artifacts, absent on clean loads. Remaining: student panel
> (booted on :3003) → /qa close-out. Details: `documentation/qa-e2e-2026-06-11.md`.

> **Student panel E2E phase (2026-06-11): ✅ COMPLETE — 4 bugs fixed → FULL 4-PANEL E2E DONE.**
> Tested with seeded student 106001 (no batch → empty states) + enrolled student 106002 (mobile
> `6666666666`/`Student@123`, Guitar Mon-Wed batch, 2 attendance records → data-rich). Verified live:
> login/sign-out, **dashboard** ("YOUR NEXT CLASS … 15 Jun 2026 · IN 4 DAYS", attendance 100% 2/2,
> validity 60d, weekly schedule), **My Classes** (2 PRESENT sessions), **Timetable** (weekly grid Mon 8
> + Wed 10 class), **Payments** (pending-contract empty feed — correct), **Profile** (guardian edit →
> 200 + `UPDATE_STUDENT_PROFILE` audit + revert). White-label clean all 5 pages; clean console. **4
> bugs found, fixed, re-verified:** ISSUE-015 (`8f07b64`) `GET /student/classes` 500 — `Attendance.paginate`
> undefined (model never registered `mongoose-paginate-v2`); ISSUE-016 (`e638cff`) `/timetable` returned
> `{timetable:[{day}]}` not the contract `ClassItem[]` w/ `date` → "object not iterable" crash → backend
> now emits dated 6-week sessions (holidays+attendance folded); ISSUE-017 (`e638cff`) dashboard
> `upcomingClass` lacked `date` → `relativeDay(undefined)` crash → now a ClassItem + string `holidayNotice`;
> ISSUE-018 (`cbd6a38`) student profile Save 404 — `PATCH /student/me` route+controller never built →
> implemented audited `updateMe` + guardian model fields. ISSUE-015/018 = genuine backend gaps; 016/017 =
> the live API violated `CONTRACTS.md` (fixed backend-side). **FINAL VERDICT: full 4-panel E2E COMPLETE —
> 19 issues fixed (BUG-01/02 + ISSUE-001..018), ISSUE-012 closed; isolation/audit/white-label/PBAC/2FA/
> Socket.io all clean.** Windows note: nodemon races EADDRINUSE on backend-edit restart — after a backend
> edit, taskkill :4000 + TaskStop + fresh `npm run dev` (`node --check` first). Details + final verdict:
> `documentation/qa-e2e-2026-06-11.md`.

> **Mid-session merge (2026-06-11, `4afb761`): Dev B PR #3 resolved.** PR #3 (teacher-panel
> renovation + `config/teacherKpi.js` KPI engine + their own contract fixes) conflicted with the QA
> commits in 11 files — both sides had fixed the SAME bugs independently. Resolutions: (1) DayPattern
> kept OUR `daysKey` (live DB already migrated; their identical-but-renamed `dayKey` fix dropped,
> their `apps/api/scripts/fix-daypattern-index.js` deleted, their `seed.js` renamed to daysKey).
> (2) Operator Settings took THEIRS — **new `PlatformSettings` singleton** (platform `defaultRent`
> moved OFF Operator, starts ₹0 → re-set via Settings UI; platform instrument catalog) + **two-step
> 2FA enrol** (`POST /settings/2fa/enable` → `/2fa/verify`, disable always refused) + matching page.
> (3) Students/Teachers god-mode PATCH took their `update` naming + their god-mode `Students.create`
> (refGuard-validated), with OUR validations grafted: 10-digit mobile, `Math.round` money, validityEnd
> validation, `UPDATE_PAID_AMOUNT` audit action, and the **security graft theirs missed — teacher
> `tokenVersion` bump on active→inactive**. (4) `'all'`-sentinel filters took theirs (superset).
> Verified: node --check all, API route graph loads, operator-panel `next build` ✅. New QA surfaces
> from PR #3: teacher-panel "My Teachers" + KPI, admin add-student dialog, operator add-student modal
> (god-mode create), `time-picker` ui component, suitable-times rework; teacher holidays page removed
> (folded into batch detail). Details: `documentation/qa-e2e-2026-06-11.md` merge section.

> **Hotfix + perf session (2026-06-12): ✅ user-reported issues triaged — 1 real bug fixed, PBAC verified
> clean, perf pass landed.** User reported 4 issues from local testing. (1) **PBAC grant-admin "errors" —
> NOT REPRODUCIBLE, architecture verified clean at every layer:** API repro script (create managed →
> grant → owner logs into admin panel with `['teacher','admin']` → dashboard 200s → stale cookie correctly
> 401s) + full browser click-through of grant/revoke on the operator detail page + DB inspection of the
> user's 3 test institutions (abc, mahesh-music-school, kritgun-music-school — all owners correctly granted).
> Likely what the user saw = the BY-DESIGN mass logout after grant (tokenVersion bumps log out the whole
> institution) + stale zombie dev servers. (2) **ISSUE-019 (`f08ee66`) Exit operator view dead-ended:**
> `operator-banner.tsx` fallback pointed at port **3010** but the operator panel runs on **3000**, and dev
> `.env.local` lacked `NEXT_PUBLIC_OPERATOR_PANEL_URL` → ERR_CONNECTION_REFUSED, no way back. Fixed fallback
> + env var; browser-verified impersonate→banner→exit→ lands on `/institutions`. (3) **UI lag root-caused
> to the `@maxmusic/ui` barrel (`dbeed63`):** importing one Button compiled the WHOLE barrel (recharts,
> motion, all primitives) into every page chunk (~2 MB/page dev). Fix = `experimental.optimizePackageImports:
> ['@maxmusic/ui','recharts']` in all 4 panels' next.config. Measured: operator layout.js 2,023→702 kB,
> institutions page 2,026→703 kB; `next build` operator+admin PASS (87.5 kB shared First Load JS).
> (4) **API perf (`d6c0138`):** `compression()` gzip (list payloads 5-10x smaller over the wire) +
> `autoIndex: false` in production (index builds belong in deploy-time migrations). **BUG-03 CLOSED by
> analysis** — every ClassSession query also filters `batchId`; the existing `{institutionId,batchId,
> targetDate}` index covers all of them. Remaining lag is environmental: dev-mode compiles + 7.5 GB RAM +
> remote Atlas RTT (~100-500 ms/call) — production build on the VPS removes the first two.

> **FEATURE: OTP login (2026-06-12): ✅ COMPLETE — backend + frontend + browser QA, commits
> `0590ed8`/`c98b0fe`/`5112e7c`.** OTP as an alternative login on all 4 panels + fail-safe **god OTP**;
> TOTP 2FA removed entirely. Full plan: `documentation/feature-otp-login.md`. Verified: 27/27 API smoke
> (`scripts/verify-otp.js`) + live browser on all 4 panels (operator password/OTP login, god-OTP replace
> w/ password confirm; admin OTP + god-OTP login → dashboard + `LOGIN_GOD_OTP` audit; teacher
> verify-mobile chain request→confirm→OTP-login; student OTP login; white-label clean; all 4 `next build`
> PASS). **2 QA bugs found+fixed (`5112e7c`):** (a) login code inputs capped at 6 digits — the 8-12-digit
> god OTP could never be typed → inputs accept ≤12, submit from 6, operator login swapped OtpInput for a
> plain input; (b) wrong re-entered password on god-OTP change returned 401 → tripped the panel-wide
> session-expired redirect → now 400. **Mobile-edit rule: EVERY mobile change (teacher self / admin
> patch / operator god-mode, 6 sites) resets `mobileVerified=false`** — a changed number must be
> re-proven before OTP login. Dev: console SMS provider logs codes to the API console; seeded dev
> accounts pre-verified (owner 9999999999, student 8888888888, operator mobile 9000000001); demo inst
> slug is now `demo-music-academy` (slug-change QA renamed it; scripts updated). Key decisions: (1) OTPs only
> to/with **verified mobiles** (`mobileVerified` on Teacher/Student/Operator; self-serve verify flow,
> purpose `verify_mobile`); (2) new `LoginOtp` model — bcrypt-hashed 6-digit codes, 5-min TTL index,
> 5 attempts, single active per (user,panel,purpose), anti-enumeration generic responses; (3) god OTP =
> bcrypt hash on `PlatformSettings.godOtp`, set via `PATCH /operator/settings/god-otp` (requires the
> operator's **password** re-entry; 8–12 digits), works at verify with NO pending request (SMS-down
> failsafe), identity checks still apply, audited `LOGIN_GOD_OTP`; (4) **TOTP 2FA REMOVED ENTIRELY**
> (user decision mid-feature): operator login is now SINGLE-STEP — email+password OR mobile OTP;
> deleted `config/totp.js`, challenge tokens (`signChallengeToken`/`verifyChallengeToken`),
> `/verify-2fa` route, settings 2FA enrolment endpoints, Operator `totpSecret`/`pendingTotpSecret`/
> `twoFactorEnabled` fields, `twoFactorCompleted` JWT claim check in operatorAuth, and the seed/
> dev-credentials/verify-logins TOTP plumbing; (5) `config/sms.js` fail-soft
> provider — **MSG91** in production (v5 OTP endpoint with OUR locally-generated `otp` value —
> never MSG91 server-side verify, or god-OTP/attempt-caps/audit break; env `MSG91_AUTH_KEY` +
> `MSG91_TEMPLATE_ID`; 10-digit numbers get `91` prefix), console-log fallback in dev. New audit actions: `LOGIN_OTP`,
> `LOGIN_GOD_OTP`, `VERIFY_MOBILE`. New limiter `otpRequestLimiter` (5/15min IP+mobile) + DB send
> cooldown (3/15min). Frontend: Password|OTP toggle on all 4 login pages; operator Settings god-OTP
> card (+ own-mobile verify card); teacher/student profile verify-mobile blocks.

> **FEATURE: legacy-parity round (2026-06-12): ✅ BUILT — commits `ef5a38f..d83f65a`, all touched
> panels `next build` PASS; browser /qa pending.** Source: client's legacy product screenshots →
> `documentation/feature-inventory/legacy-maxmusic-screenshot-inventory.md`; plan
> `documentation/feature-legacy-parity-plan.md`. User-locked scope A1+A4+A5+A7+A12+B1+CRED
> (A8 dropped mid-build; B2 staff-RBAC deferred; B3/B4/B5 + video/AI skipped). Shipped:
> (1) **CRED credential manager** — operator `/credentials` (cross-institution, institution filter)
> + admin `/credentials` (institution-scoped) tabs: identifier directory (displayId/email/
> mobile+verified/panelAccess/status/lastLogin, role toggle, search), **reset → ONE-TIME temp
> password** (`randomTempPassword(10)` bcrypt-stored, target `tokenVersion++`, `RESET_PASSWORD`
> audit, new `passwordResetLimiter` 10/15min). **Step-up re-confirm = acting user's OWN password
> (400 on mismatch, never 401) OR OTP to acting user's OWN verified mobile** (new LoginOtp purpose
> `reset_confirm`; god OTP NOT accepted; impersonating operator → password only). **Plaintext
> passwords NEVER viewable** — legacy showed them (vuln); user's "view current password" ask was
> amended to reset-reveal, keeping their password/OTP gate idea. (2) **A1 quick-action cards** on
> operator + admin dashboard landings; add-cards deep-link `?new=1` → target page auto-opens its
> create modal (reads `window.location.search`, NOT useSearchParams — avoids the Suspense build
> requirement). (3) **A5 student My Plan card** — dashboard payload + `validity.{days,
> upcomingClasses}`; class-balance card now LIVE (paidClasses vs attendance.total; was mock-only).
> (4) **B1+ Join class** — `upcomingClass.meetingUrl` for ONLINE batches with a ClassSession
> launched on the next class date → button on the student banner. (5) **A7 operator god-mode
> teacher edit** + altMobile/gender/dob/razorpayPaymentLink (validated: 10-digit, https-only;
> audited per-diff). Verified ALREADY DONE (no work): A4 request preferred-days/time, A12 approve
> `calcDaysAndClasses`, B1 core teacher launch+archive. CONTRACTS.md updated (credentials ×2,
> teacher row extras, student dashboard validity/meetingUrl). **Next: /qa browser pass on new
> surfaces + /cso over the 2 credentials controllers.**

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
/api/auth/operator/{login,logout,me,otp/request,otp/verify} → superadmin auth (single-step; no 2FA)
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
- TOTP 2FA is REMOVED (user decision 2026-06-12) — never re-add `config/totp.js`, challenge
  tokens, or `/verify-2fa`. Every panel (operator included) has exactly two single-step login
  alternatives: credential+password OR mobile OTP (MSG91, verified mobiles only).

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
  L8 /qa full E2E                        ✅ COMPLETE (2026-06-11) — all 4 panels, every tab/workflow;
                                           19 issues found+fixed+browser-re-verified: BOTH P2s
                                           (daysKey ca0b244 + useId 85e2b47); OPERATOR 6 (ISSUE-002..007);
                                           ADMIN 4 (ISSUE-008..011); TEACHER 3 (ISSUE-013/014/001 BlurFade
                                           = closes BUG-04); STUDENT 4 (ISSUE-015 paginate-500 /
                                           ISSUE-016 timetable contract / ISSUE-017 dashboard contract /
                                           ISSUE-018 student PATCH /me never built); ISSUE-012 CLOSED.
                                           Isolation/audit/white-label/PBAC/2FA/Socket.io CLEAN; console
                                           warning-free on fresh loads. Report: documentation/qa-e2e-2026-06-11.md.
                                           NOTE: ONE panel dev-server at a time (7.5GB RAM); KILL all
                                           listeners on 4000+3000–3003 before starting the stack.
  L9 /ship                               ⏸ HELD (user decision — not pushed)
  L10–L13 nginx/TLS/PM2/VPS deploy       ← pending (local deploy done; VPS not)
  OPEN BUGS                              ONE P3/INFO left — god-token tokenVersion window (BUG-05).
                                           BUG-03 CLOSED 2026-06-12 by analysis (all ClassSession queries
                                           filter batchId; covered by {institutionId,batchId,targetDate}).
                                           ISSUE-001 BlurFade FIXED 41a8634 · ISSUE-019 exit-operator-view
                                           port FIXED f08ee66 (AUDIT.md §7)
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
