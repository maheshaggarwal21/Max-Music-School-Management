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
.claude/CLAUDE.md           ← Always — this is the project bible
.claude/CONTRACTS.md        ← For review/security skills
.claude/orchestrate/tasks.md ← For planning/review phases
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

### Phase 0 — Before writing a single line of code
```
/office-hours
```
Feed it the monorepo structure from CLAUDE.md + the institution mode table.
Ask: "Review the multi-tenant architecture. What are the top 3 risks in
the institutionId isolation approach? What would you change?"

### Phase 1 — After all models are written
```
/plan-eng-review
```
Feed it all model files. Check:
- Does every model that should have institutionId actually have it?
- Are compound indexes correct for the query patterns?
- Are there any missing indexes that will cause slow queries at scale?

### Phase 2 — After all middleware is written
```
/cso
```
**Most important gstack run on the whole project.**
Read these files into context first:
```
apps/api/src/middleware/v2/resolveInstitution.js
apps/api/src/middleware/v2/scopeGuard.js
apps/api/src/middleware/v2/modeGuard.js
apps/api/src/middleware/v2/institutionAdminAuth.js
apps/api/src/config/jwt.js
```
Tell /cso to specifically check:
1. Can a user from Institution A ever get data from Institution B?
2. Is the tokenVersion check actually invalidating tokens on mode toggle?
3. Does modeGuard block managed-mode institutions from admin routes?
4. Is there any path where scopeGuard's superadmin bypass can be spoofed?

### Phase 3 — After v1 controllers are written
```
/review
```
Run per controller file, not on the whole codebase at once.
Ask /review to check: no password/jwt_token in responses, auditLog() on every
write, pagination on every list, no raw error messages in 500s.

### Phase 4 — After main school frontend is done
```
/qa
```
/qa uses Playwright. Feed it:
- The login URL (localhost:3001)
- Test credentials from seed.js
- A list of pages to walk through

Example prompt:
"Login to admin panel at localhost:3001/login with email admin@maxmusic.com
and password changeme123. Navigate to /new-requests, verify table loads and
shows pagination. Navigate to /students, search for 'test', verify filtering."

### Phase 5 — After institution backend is written (CRITICAL)
```
/cso  ← run again
```
Feed it ALL v2 institution controllers. Ask specifically:
"Check every MongoDB query in the v2/institution controllers.
Does every single query include institutionId as a filter?
Show me any query that doesn't."

Always end your /cso prompt with:
"Additionally, check every MongoDB query in the v2 institution controllers
and confirm institutionId is present in every query filter."

### Before any deploy
```
/ship
```
Feed it: ecosystem.config.js, nginx.conf, .env.example

---

## Two NON-NEGOTIABLE /cso Runs

1. **After Phase 2 middleware** — The middleware is the only thing standing between tenants
2. **After Phase 5 institution controllers** — Where cross-tenant data leaks happen

Never skip these two.

---

## Skills Map Summary

| Skill | When | Input | What to look for |
|-------|------|-------|-----------------|
| /office-hours | Pre-Phase 0 | Architecture description | Design risks |
| /plan-eng-review | After Phase 1 | All model files | Schema correctness |
| /review | After Phase 2, 3, 5 | Controller files | Code quality, security |
| /cso | After Phase 2 + Phase 5 | Middleware + controllers | Auth bypass, data isolation |
| /qa | After Phase 4 + Phase 6 | Running app URL | UI flows, broken pages |
| /ship | Before deploy | Config files | Missing env vars, PM2, SSL |
