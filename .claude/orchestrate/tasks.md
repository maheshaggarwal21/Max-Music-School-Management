# Shared Task Board
> ALL agents read this before starting any work. Single source of truth for done / in-progress / blocked.
> Architecture: ../ARCHITECTURE.md · Schemas: data-model.md · API: ../CONTRACTS.md
>
> ⚠️ CLAUDE PRO: work sequentially, one file at a time — parallel agents will burn your quota.
>    CLAUDE MAX ($100+/mo): parallel sub-agents are viable; follow the agent identity files.

---

## CURRENT SESSION GOAL
**Role:** Dev A — backend · infra · security (see `team-division.md` for full split)
**Phase:** Phase 4 (Institution APIs) ✅ — 10 controllers + 46 routes. P4-R /cso pending (MANDATORY).
**Next action:** P4-R /cso — institutionId isolation audit on every institution controller (MANDATORY before Phase 5).
**P2-R contracts — LIVE in code (verify in P4-R /cso):** (1) login JWTs embed instVersion+userVersion via config/instAuthHelpers.issuePanelCookie; (2) grant/revoke/suspend/terminate bump tokenVersion; (3) institution state changes call invalidateInstitution(slug).
**Blocking dependency:** P4-R /cso must pass before Phase 5 (frontend) — confirms no cross-institution leak in any /api/inst/:slug/* controller.

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
| P0-04 | 4 Next.js apps (operator + 3 institution panels) | **B** | ⬜ | wait for H1 |
| P0-05 | packages/ui · types · utils skeletons | **B** | ⬜ | wait for H1 |
| P0-06 | nginx.conf — path-regex routing + operator/api server blocks | **A** | ✅ | |
| P0-07 | ecosystem.config.js (PM2: api + 4 panels) | **A** | ✅ | 5 processes: api:4000 + panels:3000-3003 |
| P0-08 | .env.example (PLATFORM_DOMAIN, OPERATOR_DOMAIN, secrets, Mongo, S3, Razorpay, SMTP) | **A** | ✅ | |
| P0-09 | scripts/seed.js skeleton | **A** | ✅ | implement in Phase 1 after models |

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
| P4-R | gstack /cso — institutionId isolation grep on EVERY controller | ⬜ | ⚠️ CRITICAL — do not skip |

## PHASE 5 — OPERATOR PANEL FRONTEND
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P5-01 | packages/ui core (DataTable, Modal, StatusBadge, StatsCard, Sidebar, Form, SearchBar, Avatar) | ⬜ | Steel Blue brand |
| P5-02 | operator-panel: layout + login (2FA) | ⬜ | |
| P5-03 | Dashboard | ⬜ | |
| P5-04 | Institutions (list, create modal, detail, mode/grant/suspend, impersonate) | ⬜ | |
| P5-05 | Students (cross-inst, tags, filters) | ⬜ | |
| P5-06 | Teachers (cross-inst, tags, salary/rent) | ⬜ | |
| P5-07 | Payments (fees + rents) | ⬜ | |
| P5-08 | Changes History (timeline + before/after expand + filters) | ⬜ | |
| P5-09 | Settings (profile, 2FA, default rent, instruments) | ⬜ | |
| P5-R | gstack /qa on operator panel | ⬜ | |

## PHASE 6 — INSTITUTION PANELS FRONTEND
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P6-01 | White-label theming layer (branding → CSS vars, logo, title) | ⬜ | no Max Music anywhere |
| P6-02 | institution-admin-panel — 8 tabs + student detail popup w/ activity feed | ⬜ | |
| P6-03 | institution-teacher-panel — batches, attendance, holidays | ⬜ | |
| P6-04 | institution-student-panel — dashboard, classes, profile | ⬜ | |
| P6-R | gstack /qa — both managed (impersonation) + autonomous flows; LEAK CHECK | ⬜ | grep bundles for "maxmusic" |

## PHASE 7 — PAYMENTS + CRONS + NOTIFICATIONS
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P7-01 | Razorpay webhook handler → RazorpayWebhookEvent | ⬜ | |
| P7-02 | Daily cron: joinStatus active_soon→active, validity expiry→inactive (audit as system) | ⬜ | |
| P7-03 | Rent-due flagging cron | ⬜ | |
| P7-04 | Branded emails (Nodemailer per-institution sender) | ⬜ | grant-admin notice, reminders |
| P7-05 | Socket.io rooms by institutionId (live attendance) | ⬜ | |

## PHASE 8 — QA + DEPLOY
| ID | Task | Status | Notes |
|----|------|--------|-------|
| P8-01 | gstack /cso — full isolation pass | ⬜ | |
| P8-02 | White-label leak audit (bundles, emails, headers) | ⬜ | no operator brand on inst surfaces |
| P8-03 | gstack /qa — full E2E (3 scenarios incl. salary→independent flip) | ⬜ | |
| P8-04 | nginx + SSL (Let's Encrypt) final | ⬜ | platform + operator + api |
| P8-05 | PM2 ecosystem final + seed | ⬜ | |
| P8-06 | gstack /ship — pre-deploy checklist | ⬜ | |

---

## BLOCKED TASKS LOG
| Task ID | Blocked By | Description |
|---------|-----------|-------------|
| — | — | none yet |

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
