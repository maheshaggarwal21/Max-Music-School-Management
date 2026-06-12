# gstack — How to Use It on This Project

## What gstack actually is

gstack is Garry Tan's opinionated set of Claude Code slash-command skills (23+ skills, 8 power tools).
When you run `/cso` or `/review`, you are switching Claude Code into a specialized role.
You are the orchestrator. Claude is not running itself in parallel automatically.

**Install (30 seconds):**
```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

After setup, skills appear as /commands inside Claude Code sessions.

**Requirements:** Claude Code, Git, Bun v1.0+, Node.js (Windows only)

---

## Claude Pro Constraint

On Claude Pro ($20/month), tokens are shared across Claude.ai chat AND Claude Code.
Running `/cso` on a large codebase is expensive — it reads many files.

**Recommended schedule:**
- **Morning session**: Build code (backend or frontend)
- **Between sessions** (5-hour reset): Run gstack review/security skills
- **Evening session**: Fix issues found by gstack, continue building

---

## How to Feed Project Context to gstack Skills

Before running any gstack command, make sure Claude Code has these files in context:

```
.claude/CLAUDE.md                    ← Always — this is the project bible
.claude/CONTRACTS.md                 ← For review/security skills
.claude/orchestrate/tasks.md         ← For planning/review phases
.claude/orchestrate/data-model.md    ← For schema/model reviews
```

To explicitly give context before a skill runs:
```bash
# Inside a Claude Code session, paste this before the skill command:
"Read .claude/CLAUDE.md and .claude/CONTRACTS.md first, then run /cso"
```

---

## Full Skills Reference

### Planning & Discovery
- `/office-hours` — Product interrogation with forcing questions before coding
- `/plan-ceo-review` — Strategic scope review (Expansion, Selective, Hold, Reduction modes)
- `/plan-eng-review` — Architecture locking with data flow diagrams and edge cases
- `/plan-design-review` — Design dimension rating (0-10) with interactive feedback
- `/autoplan` — Automatic pipeline: CEO → design → eng review

### Design & Prototyping
- `/design-consultation` — Full design system generation from scratch
- `/design-shotgun` — Visual variant exploration (4-6 AI mockups with taste memory)
- `/design-html` — Convert mockups to production HTML/CSS (30KB, zero deps)
- `/design-review` — Post-ship design audit with fixes and atomic commits

### Development & Review
- `/review` — Staff engineer code review with auto-fixes and completeness checks
- `/investigate` — Root-cause debugging with hypothesis testing
- `/spec` — Convert intent into precise executable specifications
- `/ship` — Release engineer: sync, test, audit coverage, push, open PR
- `/land-and-deploy` — Merge PR, verify CI, deploy, monitor health

### Testing & Quality
- `/qa` — QA lead with real browser testing (Playwright), bug fixes, regression test generation
- `/qa-only` — Bug reporting without code changes
- `/canary` — Post-deploy monitoring for console errors and performance regressions
- `/benchmark` — Page load and Core Web Vitals comparison (before/after)

### Documentation
- `/document-release` — Auto-update all docs to match shipped changes
- `/document-generate` — Generate missing docs using Diataxis framework

### Security
- `/cso` — Chief Security Officer: OWASP Top 10 + STRIDE threat modeling
  - 17 false-positive exclusions and 8/10+ confidence gate
  - Cross-model analysis when combined with `/codex` (OpenAI)

### Browser Tools
- `/browse` — Real Chromium browser with anti-bot stealth and sidebar agent
- `/open-gstack-browser` — Headed Chromium with sidebar agent
- `/setup-browser-cookies` — Import authentication from your real browser
- `/ios-qa` — Drive real iPhone over USB

### Safety & Control
- `/careful` — Warns before destructive commands (rm, DROP TABLE, force-push)
- `/freeze` — Lock edits to specific directories during debugging
- `/guard` — Combined `/careful` + `/freeze` for maximum safety

### Memory
- `/learn` — Manage gstack's learned patterns and project-specific preferences
- `/setup-gbrain` — Initialize persistent knowledge base (local or Supabase)
- `/sync-gbrain` — Keep codebase current in knowledge base

---

## Which Skills to Use and When (This Project)

### Phase 1 — After all models are written
```
/plan-eng-review
```
Feed it all model files from `apps/api/src/models/`. Check:
- Does every institution-scoped model have a required, indexed `institutionId`?
- Are compound indexes correct for the query patterns?
- Are there any missing indexes that will cause slow queries at scale?
- Does AuditLog have `{ w: 0 }` and no `updatedAt`?

### Phase 2 — After all middleware is written (CRITICAL)
```
/cso
```
**Most important gstack run on the whole project.**
Read these files into context first:
```
apps/api/src/middleware/resolveInstitution.js
apps/api/src/middleware/scopeGuard.js
apps/api/src/middleware/panelGuard.js
apps/api/src/middleware/instAuth.js
apps/api/src/middleware/impersonation.js
apps/api/src/config/jwt.js
```
Tell `/cso` to specifically check:
1. Can a user from Institution A ever get data from Institution B?
2. Is the two-level tokenVersion check (institution + user) actually invalidating tokens on mode toggle and grant/revoke?
3. Does panelGuard block teachers without `'admin'` in panelAccess from admin routes?
4. Is there any path where scopeGuard's god-token bypass can be spoofed?
5. Are institution cookies path-scoped to `/api/inst/:slug` so they can't be sent cross-institution?

### Phase 3 — After operator controllers are written
```
/review
```
Run per controller file, not on the whole codebase at once.
Ask `/review` to check:
- No password/passwordHash/recoveryOtp/otp in any response
- `auditLog()` called on every write, with `{ w: 0 }` — never synchronous/blocking
- Pagination on every list endpoint
- No raw `err.message` or stack traces in 500 responses
- All responses via `Helper.response()` — no bare `res.json()`

### Phase 4 — After institution controllers are written (CRITICAL)
```
/cso  ← run again
```
Feed it ALL institution controllers under `apps/api/src/controllers/institution/`.
Ask specifically:
"Check every MongoDB query in the institution controllers.
Does every single query include `institutionId` as a filter?
Show me any query that doesn't — that is a multi-tenant data isolation bug."

Self-check command to run before invoking `/cso`:
```bash
grep -nE "\.find|\.findOne|\.findOneAndUpdate|\.updateMany|\.deleteOne|\.aggregate" \
  apps/api/src/controllers/institution/**/*.js | grep -v institutionId
# Zero output = safe. Any output = fix before calling /cso.
```

### Phase 5 — After operator panel frontend is done
```
/qa
```
`/qa` uses Playwright. Feed it:
- The operator panel login URL (localhost:3000)
- Test credentials from `scripts/seed.js`
- A list of pages: dashboard, institutions list, create institution, students cross-view, teachers cross-view, payments, changes history
- The 2FA flow (TOTP required on operator login)

### Phase 6 — After institution panels frontend is done
```
/qa  ← run again
```
Test both paths:
1. **Autonomous institution** — owner logs in as admin, then as teacher (same credentials)
2. **Managed institution** — superadmin impersonates, verifies brand shows institution name only

**White-label leak check — run this before /qa:**
```bash
# Grep built bundles for any "Max Music" or operator domain reference
grep -rn "Max Music\|maxmusic\|OPERATOR_DOMAIN" apps/institution-*/
# Expected: zero results
```

### Before any deploy
```
/ship
```
Feed it: `ecosystem.config.js`, `nginx.conf`, `.env.example`

---

## Two NON-NEGOTIABLE /cso Runs

1. **After Phase 2 middleware** — The middleware is the only thing standing between tenants
2. **After Phase 4 institution controllers** — Where cross-tenant data leaks happen

Never skip these two.

---

## Skills Map Summary

| Skill | When | Input | What to look for |
|-------|------|-------|-----------------|
| /plan-eng-review | After Phase 1 | All model files | Schema correctness, indexes |
| /review | After Phase 3, 4 | Controller files | Code quality, security basics |
| /cso | After Phase 2 + Phase 4 | Middleware + controllers | Auth bypass, data isolation |
| /qa | After Phase 5 + Phase 6 | Running app URL | UI flows, white-label leak |
| /ship | Before deploy | Config files | Missing env vars, PM2, SSL |

---

# Official README Reference (merged 2026-06-12 — codex/OpenClaw/iOS sections excluded; not available on this box)

## The sprint — skills run in sprint order

**Think → Plan → Build → Review → Test → Ship → Reflect**

Each skill feeds the next: `/office-hours` writes a design doc → `/plan-ceo-review` reads it →
`/plan-eng-review` writes a test plan → `/qa` picks it up → `/review` finds bugs → `/ship` verifies fixed.

## Which review to use?

| Building for... | Plan stage (before code) | Live audit (after shipping) |
|---|---|---|
| **End users** (UI, web app) | `/plan-design-review` | `/design-review` |
| **Developers** (API, CLI, docs) | `/plan-devex-review` | `/devex-review` |
| **Architecture** (data flow, perf, tests) | `/plan-eng-review` | `/review` |
| **All of the above** | `/autoplan` (CEO → design → eng → DX, auto-detects which apply) | — |

## Skill roles (one-liners)

- `/office-hours` — six forcing questions that reframe the product before code; design doc feeds downstream skills
- `/plan-ceo-review` — 4 scope modes: Expansion / Selective Expansion / Hold Scope / Reduction
- `/plan-eng-review` — ASCII data-flow diagrams, state machines, error paths, test matrix, failure modes
- `/plan-design-review` — rates each design dimension 0-10, explains what a 10 looks like, AI-slop detection; interactive
- `/plan-devex-review` — DX personas, TTHW benchmarks, friction trace; modes: DX EXPANSION / POLISH / TRIAGE
- `/autoplan` — full review pipeline with encoded auto-decisions; surfaces only taste decisions
- `/design-consultation` — full design system from scratch (researches landscape, writes DESIGN.md)
- `/design-shotgun` — 4-6 AI mockup variants → browser comparison board → feedback loop; taste memory learns picks
- `/design-html` — mockup → production HTML/CSS (Pretext computed layout, 30KB, zero deps; detects React)
- `/design-review` — same audit as plan-design-review then FIXES findings; atomic commits, before/after screenshots
- `/review` — staff-engineer diff review: bugs that pass CI but blow up in prod; auto-fixes obvious ones
- `/investigate` — Iron Law: no fixes without investigation; traces data flow, tests hypotheses, stops after 3 failed fixes
- `/spec` — vague intent → executable spec in 5 phases (why, scope, technical w/ mandatory code-reading, draft, file)
- `/qa` — browser QA + fixes with atomic commits + auto-generated regression test per fix; 3 tiers (Quick/Standard/Exhaustive)
- `/qa-only` — same methodology, report only, zero code changes
- `/cso` — OWASP Top 10 + STRIDE; daily mode (8/10 confidence gate, zero-noise) vs comprehensive monthly (2/10 bar); trend tracking
- `/ship` — sync main, run tests, audit coverage, bump VERSION, CHANGELOG, push, PR; bootstraps test framework if missing; auto-invokes /document-release
- `/land-and-deploy` — merge PR → wait CI → deploy → verify production health (needs /setup-deploy once)
- `/canary` — post-deploy loop: console errors, perf regressions, page failures
- `/benchmark` — baseline page loads, Core Web Vitals, resource sizes; before/after per PR
- `/document-release` — cross-references diff vs every doc file; updates what drifted; Diataxis coverage map in PR body
- `/document-generate` — writes missing docs from scratch (reference / how-to / tutorial / explanation)
- `/retro` — weekly retro: shipping streaks, test health trends; `/retro global` spans all projects
- `/learn` — review/search/prune what gstack learned about this project (compounds across sessions)
- `/health` — code quality dashboard
- `/context-save` · `/context-restore` — save/resume working context across sessions
- `/scrape` — pull data from a web page; `/skillify` codifies the last successful scrape into a permanent browser-skill

## Safety & control

- `/careful` — warns before destructive commands (rm -rf, DROP TABLE, force-push, git reset --hard); any warning overridable
- `/freeze <dir>` — lock edits to one directory (use while debugging); `/unfreeze` clears
- `/guard` — `/careful` + `/freeze` combined, for prod work
- `/investigate` auto-freezes to the module under investigation

## /browse extras

- `$B domain-skill save` — per-site note (auto-fires on that hostname next visit); quarantined → active after 3 uses
- `$B handoff` — stuck on CAPTCHA/auth/MFA? opens a visible Chrome at the same page with cookies+tabs intact; solve it, then `$B resume` (agent suggests it after 3 consecutive failures)
- `$B cdp <Domain.method>` — raw Chrome DevTools Protocol escape hatch (deny-default allowlist)
- `/setup-browser-cookies` — import cookies from real Chrome/Edge into headless session (test authenticated pages)
- `/open-gstack-browser` — headed Chromium w/ sidebar agent + anti-bot stealth (Google etc. work captcha-free)

## Continuous checkpoint mode (opt-in)

`gstack-config set checkpoint_mode continuous` → skills auto-commit WIP with structured `[gstack-context]` body
(decisions, remaining work, failed approaches). `/context-restore` reconstructs session state from those commits.
`/ship` filter-squashes WIP commits before PR so bisect stays clean. Push stays local unless `checkpoint_push=true`.

## Config & maintenance

```bash
gstack-config set <key> <value>     # telemetry off · proactive false · checkpoint_mode continuous …
gstack-analytics                    # local usage dashboard (JSONL, no remote)
/gstack-upgrade                     # self-update; or auto_upgrade: true in ~/.gstack/config.yaml
```

## Windows notes (this box)

- Works via Git Bash; Node.js required besides Bun (Bun+Playwright pipe bug → browse server auto-falls back to Node)
- No Developer Mode → setup uses file copies, not symlinks → **re-run `cd ~/.claude/skills/gstack && ./setup` after every `git pull`**
- `/browse` fails? `cd ~/.claude/skills/gstack && bun install && bun run build`
- Skill missing? re-run `./setup`

## Voice triggers

Skills respond to natural phrases: "run a security check" → /cso · "test the website" → /qa ·
"do an engineering review" → /plan-eng-review · "code review" → /review
