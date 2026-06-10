# Shared Task Board
> ALL agents read this before starting any work. Single source of truth for done / in-progress / blocked.
> Architecture: ../ARCHITECTURE.md · Schemas: data-model.md · API: ../CONTRACTS.md
>
> ⚠️ CLAUDE PRO: work sequentially, one file at a time — parallel agents will burn your quota.
>    CLAUDE MAX ($100+/mo): parallel sub-agents are viable; follow the agent identity files.

---

## CURRENT SESSION GOAL
**Team:** Dev A / Dev B split **DISSOLVED** — one team finishing the whole project (backend + frontend + infra + QA + deploy all in scope). Old split: `team-division.md` (reference only).
**State:** Backend (Phases 0–4 + 7) COMPLETE. All 4 panels built; admin panel renovated + supporting APIs merged (PR #2, `0150b90`).
**Live deploy DONE (2026-06-11):** all 5 processes up locally vs Mongo Atlas; all 4 panel logins verified (API + browser, incl. operator TOTP 2FA). SWC binary fix (`@next/swc-win32-x64-msvc@14.2.33` + `NEXT_IGNORE_INCORRECT_LOCKFILE=1`); start panels independently, not via turbo. Creds via `scripts/dev-credentials.js`, verified by `scripts/verify-logins.js`.
**gstack pipeline re-run DONE (2026-06-11) — ✅ all 6 PASS** (eng-review + cso×2 + review + qa×2). Isolation/audit/white-label/PBAC/2FA clean. See `../AUDIT.md §6`.
**Full end-to-end audit (2026-06-10) — ✅ PASS** (`../AUDIT.md`): isolation, refGuard, audit-logging, white-label, token storage, slug immutability, types/build all clean.
**Next action:** fix the **2 open P2 bugs** → (a) `models/DayPattern.js:38` multikey unique index (use derived sorted `daysKey`); (b) `packages/ui/src/components/form/input.tsx:15` counter → React 18 `useId()`. Then `/qa` full 3-scenario E2E (P8-03), then `/ship` (currently HELD) + VPS deploy (L11–L13 / P8-04–06 infra ready).
**Blocking dependency:** VPS deploy needs production `.env` (S3/SMTP/Razorpay creds + real domains).

---

## HOW TO USE
1. Find the first ⬜ in the current phase → mark 🔄 before touching a file → complete → mark ✅ → next.
2. Blocker: mark ❌, log it in BLOCKED TASKS, stop.
3. Status: ⬜ not started · 🔄 in progress · ✅ done · ❌ blocked

---

## ARCHITECTURE LOCK (decisions that gate everything below)
- **Pure operator** — no main school; every operational record has a required `institutionId`.
- **4 apps** — operator-panel + institution-{admin,teacher,student}-panel.
- **Path routing** on a neutral `<PLATFORM_DOMAIN>` (`/<slug>/<panel>`); operator on a private domain.
- **White-label** — no Max Music brand/name/domain on any institution panel/email/URL.
- **PBAC** — institution admin = owner Teacher with `panelAccess ⊇ {admin}`; one credential, two panels.
- **Manual fees** + Razorpay webhook reconciliation. **Rent** tracked via RentInvoice.
- **Daily cron** advances student `joinStatus` / validity.
- **Operator 2FA**, **two-level token invalidation** (institution + user `tokenVersion`).

---

## PHASE 0 — SCAFFOLD
> Dev A owns P0-01 through P0-03, P0-06 through P0-09. Push P0-01 + P0-02 first — Dev B is blocked on them.

| ID | Task | Owner | Status | Notes |
|----|------|-------|--------|-------|
| P0-01 | Root package.json + Turborepo workspaces | **A** | ✅ | |
| P0-02 | turbo.json pipeline | **A** | ✅ | → H1: Dev B unblocked |
| P0-03 | apps/api skeleton (package.json + src/server.js + full folder tree) | **A** | ✅ | all stubs created |
| P0-04 | 4 Next.js apps (operator + 3 institution panels) | **B** | ✅ | wait for H1 |
| P0-05 | packages/ui · types · utils skeletons | **B** | ✅ | wait for H1 |
| P0-06 | nginx.conf — path-regex routing + operator/api server blocks | **A** | ✅ | |
| P0-07 | ecosystem.config.js (PM2: api + 4 panels) | **A** | ✅ | 5 processes: api:4000 + panels:3000-3003 |
| P0-08 | .env.example (PLATFORM_DOMAIN, OPERATOR_DOMAIN, secrets, Mongo, S3, Razorpay, SMTP) | **A** | ✅ | |
| P0-09 | scripts/seed.js | **A** | ✅ | Operator + TOTP QR + 8 instruments + demo institution + owner teacher; idempotent |

## PHASE 1 — MODELS (core MVP set) + types
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P1-01 | Operator | ✅ | 2FA fields, tokenVersion |
| P1-02 | Institution | ✅ | slug immutable (schema + pre-update hook), branding subdoc, rent subdoc |
| P1-03 | Teacher | ✅ | panelAccess, isOwner, unique {inst,email}+{inst,displayId}; +{inst,mobile}+{inst,employmentType} (P1-R) |
| P1-04 | Student | ✅ | full lifecycle fields, unique {inst,displayId}, validityEnd cron; +{inst,mobile}+{inst,instrumentId} (P1-R) |
| P1-05 | EnrollmentRequest | ✅ | handledBy subdoc, paginate |
| P1-06 | Batch | ✅ | refs instrument/dayPattern/timeSlot/teacher, setting status default |
| P1-07 | DayPattern · TimeSlot · Instrument | ✅ | derived label hooks + pre(findOneAndUpdate) re-derive; unique compound indexes |
| P1-08 | Attendance · Holiday | ✅ | unique {student,batch,date} on attendance |
| P1-09 | Payment · RentInvoice · RazorpayWebhookEvent | ✅ | paginate on all three; RazorpayWebhookEvent has 12-month TTL on receivedAt (T-001 done) |
| P1-10 | AuditLog (immutable) | ✅ | pre-update + pre-delete hooks throw; no updatedAt |
| P1-11 | UniqueIdCounter | ✅ | unique {inst,entityType} |
| P1-12 | packages/types — interfaces for all models | ✅ | models.ts + api.ts + index barrel → H2 |
| P1-R | gstack /plan-eng-review on models (indexes, isolation) | ✅ | 5 fixes: {inst,mobile}/{inst,instrumentId}/{inst,employmentType} indexes; DayPattern+TimeSlot label re-derive on findOneAndUpdate; Institution slug $setOnInsert guard. T5 (security invariant tests) pending |

## PHASE 2 — AUTH + PBAC MIDDLEWARE
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P2-01 | config: db, jwt (per-panel secrets), helper, auditLog (w:0), specialFunctions (slug, displayId), strings, totp, s3 + Phase 7 stubs (mailer/razorpay/socket/cron) | ✅ | 12 files |
| P2-02 | operatorAuth + 2FA (TOTP) | ✅ | twoFactorCompleted claim required |
| P2-03 | resolveInstitution (cache, 404 unknown, 403 suspended) | ✅ | TTL 5 min + invalidateInstitution(slug) |
| P2-04 | instAuth(panel) — 2-level tokenVersion + panelAccess check | ✅ | god-token path short-circuits |
| P2-05 | scopeGuard | ✅ | actor.institutionId === institution._id; god bypass |
| P2-06 | panelGuard('admin') — PBAC | ✅ | god bypass |
| P2-07 | impersonation god-token issue + accept (bypass scope/panel, stamp impersonatedBy) | ✅ | issueGodCookie + impersonatedByFromActor |
| P2-08 | login rate limiting + cookie path-scoping | ✅ | loginLimiter, operatorLoginLimiter, apiLimiter |
| P2-R | gstack /cso on all middleware | ✅ | 5 checkpoint Qs verified clean; 2 HIGH findings fixed (.gitignore + lockfile); nodemailer 6→8 + node-cron 3→4 upgraded; 3 Phase 3 mandatory contracts documented |

## PHASE 3 — OPERATOR (SaaS) APIs
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P3-01 | Auth controllers (operator login/2fa/logout/me) | ✅ | 2-step 2FA-mandatory; challengeToken→TOTP→operator_token; constant-time-ish compare |
| P3-02 | InstitutionController — CRUD, slug gen, activate | ✅ | create(slug+owner teacher, ownerTempPassword once), list(batched counts), get(detail), update(no slug/mode) |
| P3-03 | grant-admin / revoke-admin (panelAccess + mode + tokenVersion) | ✅ | P2-R: bumps owner+inst tokenVersion, invalidateInstitution(slug), audit TOGGLE_MODE |
| P3-04 | suspend / reactivate / terminate | ✅ | suspend+terminate bump inst.tokenVersion; all 3 invalidateInstitution(slug) |
| P3-05 | impersonate endpoint | ✅ | issueGodCookie path-scoped; returns url+expiresInSec; audit IMPERSONATE_START |
| P3-06 | Cross-institution Students view (tagged) | ✅ | list+get, institution/teacher/batch/instrument tags, filters |
| P3-07 | Cross-institution Teachers view (tagged, salary/rent) | ✅ | amount=salary or owner rent; activeBatches; role owner/staff |
| P3-08 | Payments (student fees) + RentInvoices + mark-paid | ✅ | fees stream+summary, rent-invoices stream, markRentPaid audits MARK_RENT_PAID |
| P3-09 | Changes History (global audit) + filters | ✅ | AuditLog timeline, filters institutionId/entityType/action/actorRole/actorName/date |
| P3-10 | Dashboard aggregations + Settings | ✅ | dashboard counts+revenue+recent+overdue; settings profile/2FA-enrol/instruments |
| P3-11 | routes/operator.js + auth.js wired in server.js | ✅ | 29 routes; operatorAuth gate; apiLimiter+operatorLoginLimiter |
| P3-R | gstack /review on operator controllers | ✅ | 5 fixes: existingTeacher isolation guard, grant/revoke idempotency (no mass-logout), impersonate targetUserId required, update audits branding/rent |

## PHASE 4 — INSTITUTION APIs
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P4-01 | inst auth controllers (admin/teacher/student login, me, logout) | ✅ | JWT embeds instVersion+userVersion (P2-R #1); brandingPublic only; path-scoped cookie |
| P4-02 | admin: Requests (list/create/approve/reject) | ✅ | approve→Student (displayId+tempPassword), links request |
| P4-03 | admin: Students (list/detail/create/patch/activity) | ✅ | whitelisted editable fields, every diff audited; activity=AuditLog by entityId |
| P4-04 | admin: Teachers (list/create/patch) | ✅ | rejects panelAccess/isOwner/employmentType (operator-only); temp password once |
| P4-05 | admin: Batches (list/create/patch, name auto-encode) | ✅ | refs verified in-institution; encodeBatchName; studentCount maintained |
| P4-06 | admin: Attendance grid | ✅ | batch+range→dates[]+rows{marks}; holidays folded in |
| P4-07 | admin: Day-patterns + Time-slots (CRUD + toggles) | ✅ | dup→400; label hooks; toggles audited |
| P4-08 | admin: Payments (manual entry + reconciliation feed) | ✅ | paid fee bumps Student.paidAmount; webhook feed read-only |
| P4-09 | teacher: batches, attendance mark, holidays, me | ✅ | double-scope (inst+own teacherId); mark upserts+emit; holiday credits/reverses |
| P4-10 | student: dashboard, classes, timetable, me | ✅ | own data only; brandingPublic; no Max Music identifiers |
| P4-11 | routes/institution.js (full middleware chains) | ✅ | 46 routes; resolveInstitution→instAuth→scopeGuard→[panelGuard] |
| P4-R | gstack /cso — institutionId isolation grep on EVERY controller | ✅ | 1 HIGH fixed: studentRefsValid() rejects foreign teacher/batch/instrument refs in student create/patch + request approve (cross-tenant populate leak). 5 checkpoint Qs otherwise clean |

## PHASE 5 — OPERATOR PANEL FRONTEND
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P5-01 | packages/ui core (DataTable, Modal, StatusBadge, StatsCard, Sidebar, Form, SearchBar, Avatar) | ✅ | Steel Blue brand |
| P5-02 | operator-panel: layout + login (2FA) | ✅ | |
| P5-03 | Dashboard | ✅ | |
| P5-04 | Institutions (list, create modal, detail, mode/grant/suspend, impersonate) | ✅ | |
| P5-05 | Students (cross-inst, tags, filters) | ✅ | |
| P5-06 | Teachers (cross-inst, tags, salary/rent) | ✅ | |
| P5-07 | Payments (fees + rents) | ✅ | |
| P5-08 | Changes History (timeline + before/after expand + filters) | ✅ | |
| P5-09 | Settings (profile, 2FA, default rent, instruments) | ✅ | |
| P5-R | gstack /qa on operator panel | ✅ | 2026-06-11 browser: login + 6-digit TOTP 2FA → /dashboard works; no console errors on login. Full page-by-page click-through deferred to P8-03 |

## PHASE 6 — INSTITUTION PANELS FRONTEND
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P6-01 | White-label theming layer (branding → CSS vars, logo, title) | ✅ | no Max Music anywhere |
| P6-02 | institution-admin-panel — 8 tabs + student detail popup w/ activity feed | ✅ | |
| P6-03 | institution-teacher-panel — batches, attendance, holidays | ✅ | |
| P6-04 | institution-student-panel — dashboard, classes, profile | ✅ | |
| P6-R | gstack /qa — both managed (impersonation) + autonomous flows; LEAK CHECK | ✅ | 2026-06-11: white-label PASS at source AND runtime — all 3 inst login pages + student post-login render "Demo Music School" only, hasMaxMusic=false. Found P2 Input hydration mismatch (mm-input ids, all forms). Impersonation flow click-through deferred to P8-03 |

## PHASE 7 — PAYMENTS + CRONS + NOTIFICATIONS  ✅ (backend)
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P7-01 | Razorpay webhook handler → RazorpayWebhookEvent | ✅ | `POST /api/webhooks/razorpay` mounted pre-json with `express.raw`; timing-safe HMAC verify (fails closed); idempotent by paymentId+eventType; tenant from payload `notes` (institutionId/slug), unattributed still stored; read-only feed, never touches Payment ledger |
| P7-02 | Daily cron: joinStatus active_soon→active, validity expiry→inactive (audit as system) | ✅ | `config/cron.js` 00:05 `CRON_TZ` (def Asia/Kolkata); per-student audit `ADVANCE_STUDENT_STATUS`/`EXPIRE_VALIDITY` as system actor → shows in activity feed |
| P7-03 | Rent-due flagging cron | ✅ | same daily job: pending RentInvoice past dueDate → overdue (updateMany) |
| P7-04 | Branded emails (Nodemailer per-institution sender) | ✅ | `config/mailer.js` + `config/emailTemplates.js`; From = institution schoolName; triggers wired: owner welcome (inst create), teacher welcome (teacher create), student welcome (request approve), grant-admin notice — all fail-soft |
| P7-05 | Socket.io rooms by institutionId (live attendance) | ✅ | `config/socket.js` shares HTTP server; handshake-auth via short-lived socket token (`GET /:slug/{admin,teacher}/realtime-token`) — panel cookies are path-scoped so can't reach `/socket.io`; room = `inst:<id>` from VERIFIED token only; `emitToInstitution` already called by teacher markAttendance |

## PHASE 8 — QA + DEPLOY
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P8-01 | gstack /cso — full isolation pass | ✅ | 2026-06-11: re-ran /cso on middleware + all 14 institution controllers post-renovation. 0 cross-tenant leaks; every $match/filter leads with institutionId; belongs-checks gate foreign ids. 1 INFO (god-token doesn't re-check operator.tokenVersion) |
| P8-02 | White-label leak audit (bundles, emails, headers) | ✅ | 2026-06-11: source scan = zero brand strings (all hits are @maxmusic/* import names); runtime browser check = inst panels render institution brand only. P3 note: @maxmusic npm scope in bundle module paths |
| P8-03 | gstack /qa — full E2E (3 scenarios incl. salary→independent flip) | ◑ | /qa ran (login+2FA + white-label runtime verified). Full 3-scenario onboarding walk still pending |
| P8-04 | nginx + SSL (Let's Encrypt) final | ✅ | HTTP→HTTPS redirects; full HTTPS blocks; security headers (X-Frame/CSP/HSTS/nosniff); Socket.io WebSocket upgrade on api block; gzip; client_max_body_size |
| P8-05 | PM2 ecosystem final + seed | ✅ | ecosystem.config.js complete (5 processes, log files, mem limits); seed.js implemented |
| P8-06 | gstack /ship — pre-deploy checklist | ⏸ | HELD by user decision (not pushed). Run after the 2 open P2s are fixed |

---

## PHASE 5/6 — FRONTEND INTEGRATION (Dev A pass over Dev B's merged frontend)
> Dev B built all 4 panels + packages/ui/utils (PR #1, mock-mode). Dev A integration pass this session:

| ID | Task | Status | Notes |
|----|------|--------|-------|
| FI-01 | H2 type migration — 4 apps re-export shared contract from `@maxmusic/types` (was local mirrors) | ✅ | view/row types stay local; `tsc --noEmit` clean ×4 |
| FI-02 | `[slug]` routing fix — 3 institution panels moved to `app/[slug]/<panel>/(auth\|dashboard)/*` | ✅ | flat route-groups 404'd behind nginx; `next build` ✅ ×4 |
| FI-03 | Slug-aware nav/login/sign-out via `useParams`; bare-panel `[slug]/<panel>/page.tsx` index redirect | ✅ | |
| FI-04 | 401-redirect → `/<slug>/<panel>/login` (was hardcoded `/login`) in 3 inst api clients | ✅ | real-API correctness |
| FI-05 | Teacher slug from URL `getInstSlug()` (was build-time `NEXT_PUBLIC_INSTITUTION_SLUG`) | ✅ | env var = one-slug-per-build, broke multi-tenant |
| FI-06 | Public `GET /api/inst/:slug/branding` (controller + route + CONTRACTS) | ✅ | resolveInstitution only; brandingPublic; wired into all 3 login pages |
| FI-07 | win32 native binaries → root `optionalDependencies` (Linux CI/deploy safe) | ✅ | lockfile is Linux-generated, omitted win32 optionals |
| FI-R | White-label leak grep on institution `src` (excl. `@maxmusic/*` import scope) | ✅ | zero rendered leaks |
| — | Teacher live-attendance `TODO(H3)` | ✅ | `lib/socket.ts` useSocket hook; fetches realtime-token → socket.io-client auth handshake → listens `attendance:marked` for current batch+date → re-fetches marks |
| — | H4/H5 — flip off mock mode (`NEXT_PUBLIC_API_URL`) + gstack `/qa` | ✅ | 2026-06-11: all 4 panels live vs Mongo Atlas; 4 logins verified (API+browser); /qa ran. `.env.local` × 4 set NEXT_PUBLIC_API_URL=http://localhost:4000 |

---

## BLOCKED TASKS LOG
| Task ID | Blocked By | Description |
|---------|-----------|-------------|
| — | — | none yet |

## OPEN BUGS (from gstack re-run 2026-06-11 — not yet fixed, /ship held)
| ID | Sev | File | Bug | Fix |
|----|-----|------|-----|-----|
| BUG-01 | P2 | `apps/api/src/models/DayPattern.js:38` | `index({institutionId,days},{unique})` is multikey-unique (days is an array) → 2 patterns sharing any one day collide on E11000; intent is unique day-SET | drop unique multikey; derived sorted `daysKey` string + unique `{institutionId,daysKey}` (or controller set-uniqueness) |
| BUG-02 | P2 | `packages/ui/src/components/form/input.tsx:15` | module-level counter `mm-input-${++inputAutoId}` diverges server vs client → hydration mismatch on every form, all 4 panels | replace with React 18 `useId()` |
| BUG-03 | P3 | `apps/api/src/models/ClassSession.js:28` | possibly missing `{institutionId,targetDate}` index | verify vs queries; add only if "today's classes for institution" is queried |
| BUG-04 | P3 | `packages/ui` | `ref is not a prop` React warning | pass ref via forwardRef / different prop |
| BUG-05 | INFO | `apps/api/src/middleware/instAuth.js:73` | god-token path doesn't re-check `operator.tokenVersion` (15-min window) | re-check tokenVersion on god path if operator revocation must be instant |

---

## DECISIONS LOG
| Decision | Reason |
|----------|--------|
| Pure operator (no main school; institutionId required everywhere) | Business pivoted to umbrella-only; removes the null-tenant special case |
| Path routing on a neutral domain, slug leads the path | Shadow/white-label: students see the school name, never "maxmusic" |
| PBAC: institution admin = owner Teacher with panelAccess ⊇ {admin} | One credential opens both panels; salary→independent is a single button |
| Admin panel deployed for ALL institutions; access PBAC-gated | Managed = superadmin impersonates; instant upgrade to autonomous |
| Manual fees + Razorpay webhook reconciliation | Per-teacher links can't be cleanly auto-attributed; matches current product |
| Rent tracked via RentInvoice (operator revenue) | App tracks money, doesn't route it |
| Daily cron advances joinStatus/validity | Matches current "changed BY SYSTEM" behavior |
| Operator 2FA + two-level tokenVersion | God-mode hardening + granular logout |
| Slug immutable | Changing it breaks URLs + path-scoped cookies |
| One MongoDB, filtered by institutionId | Simpler ops + free cross-institution analytics for operator |
| 8-tab institution admin MVP (video/analytics/etc deferred) | Ship the core loop first |
| Institution panels use a real Next `[slug]` route segment (not flat route-groups) | nginx preserves `/<slug>/<panel>`; flat routes 404 + client-nav drops the slug. Slug read via `getInstSlug()` (first path segment), never a build-time env var |
| Public `GET /api/inst/:slug/branding` endpoint (pre-auth) | Login pages need white-label identity before sign-in; resolveInstitution gives 404/403; returns brandingPublic only |
| Socket.io auth via short-lived socket token (not the panel cookie) | Panel cookies are httpOnly + path-scoped to `/api/inst/:slug`, so the browser never sends them to `/socket.io`. An authenticated REST call mints a 2-min `JWT_SECRET_SOCKET` token (dedicated secret, can't be replayed as a cookie); room = institutionId from the VERIFIED token, never client input |
| Razorpay webhook is platform-level + read-only | Razorpay calls one URL; tenant recovered from payload `notes`. Mounted pre-json with `express.raw` so HMAC sees exact bytes; writes only the RazorpayWebhookEvent reconciliation feed, never the Payment ledger (app tracks money, doesn't route it) |
| Pin `@next/swc-win32-x64-msvc@14.2.33` + run panels with `NEXT_IGNORE_INCORRECT_LOCKFILE=1` | 14.2.35 doesn't exist on npm (next@14.2.35 pins swc to 14.2.33); Next's lockfile auto-patch crashed on the missing version. Env var skips the patch entirely. (Windows local-dev fix; Linux deploy uses FI-07 omitted-optionals lockfile) |
| Start the 5 dev processes independently on Windows, not via `turbo run dev` | turbo aborts ALL tasks if one fails and doesn't reliably pass the env var through; independent `next dev -p <port>` per panel keeps the others alive and gets the lockfile-patch bypass |
| Dev login creds set via `scripts/dev-credentials.js`, not from seed output | seed's temp passwords are random + printed once to console, lost across sessions; the dev script resets them to known values (Operator@123 / Teacher@123 / Student@123) for QA and grants the owner teacher admin access |
