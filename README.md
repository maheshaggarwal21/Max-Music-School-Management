# Max Music School

A **white-label, multi-tenant music-school SaaS platform**. Max Music School is the *operator
behind the curtain*: individual music teachers each get a fully-branded "mini music school"
(an **institution**) with its own admin, teacher, and student panels. Students never see the
operator brand.

> ✅ **Built and deployed.** Backend + all 4 panels are complete; a public free-tier demo runs
> on Render (API) + Vercel (panels) against MongoDB Atlas. See `.claude/documentation/DEPLOY.md`.

## Status

| Area | State |
|------|-------|
| Architecture & data model | ✅ Complete |
| API contracts | ✅ Complete (`.claude/CONTRACTS.md`) |
| Backend (API, auth/PBAC, isolation, cron, webhooks, Socket.io) | ✅ Complete |
| Frontend (operator + admin + teacher + student panels) | ✅ Complete |
| Full E2E QA (all 4 panels) | ✅ Passed |
| Free-tier cloud deploy (Render + Vercel) | ✅ Live |
| Production VPS deploy (custom domains) | ⬜ Pending |

## Tech stack

- **Backend:** Node.js · Express · MongoDB (Mongoose, mongoose-paginate-v2)
- **Frontend:** Next.js 14 (App Router) — 4 separate apps, one per panel
- **Monorepo:** Turborepo (4 apps + 3 packages)
- **Auth:** JWT in httpOnly cookies (PBAC `panelAccess`); password **or** mobile OTP (MSG91)
- **Payments:** Razorpay (tracks money, does not route it) · **Email:** Nodemailer (branded per-institution)
- **Realtime:** Socket.io (live attendance) · **Scheduler:** node-cron (daily status/validity)
- **Infra:** Nginx · PM2 (5 processes: api + 4 panels)

## Repository layout

```
apps/
  api/                          Express API (all backend routes)
  operator-panel/               Private superadmin UI (port 3000)
  institution-admin-panel/      Institution admin UI (3001)
  institution-teacher-panel/    Teacher UI (3002)
  institution-student-panel/    Student UI (3003)
packages/
  types/   ui/   utils/         Shared contract types, components, helpers
scripts/                        seed, dev-credentials, verify, migrations
.claude/                        Canonical project docs (see below)
```

## The four panels

| Panel | Used by | URL pattern |
|---|---|---|
| Operator | superadmin (the operator) | `https://<operator-domain>/` (private) |
| Admin | owner-teacher / impersonating operator | `https://<platform>/<slug>/admin` |
| Teacher | each teacher | `https://<platform>/<slug>/teacher` |
| Student | each student | `https://<platform>/<slug>/student` |

## Getting started (local dev, Windows)

Full procedure + working demo credentials: **`TESTING-CREDENTIALS.md`**.

```bash
# API (port 4000)
cd apps/api && npm run dev
# A panel (run ONE at a time on a low-RAM box) — e.g. operator on :3000
cd apps/operator-panel && NEXT_IGNORE_INCORRECT_LOCKFILE=1 npx next dev -p 3000
# Reset known dev passwords + verify logins
node scripts/dev-credentials.js && node scripts/verify-logins.js
```

Requires a `.env` at the repo root (`cp .env.localdev .env`, or see `.env.example`).

## Deployment

- **Free-tier cloud (live):** `.claude/documentation/DEPLOY.md` §0 — Render (API) + Vercel (4 panels) + Atlas.
- **Production VPS:** `.claude/documentation/DEPLOY.md` §1+ — Nginx, TLS, PM2, env setup.

## Project docs (canonical, in `.claude/`)

- `CLAUDE.md` — master memory / bootstrap (read first)
- `ARCHITECTURE.md` — full architecture reference
- `CONTRACTS.md` — API contracts
- `orchestrate/data-model.md` — Mongoose schemas
- `orchestrate/tasks.md` — live task board

## AI development setup (Claude Code)

This project uses [gstack](https://github.com/garrytan/gstack) — Claude Code slash-command skills
for security audits, QA, design review, and more.

```bash
# 1. Install Bun (Windows):  powershell -c "irm bun.sh/install.ps1 | iex"
# 2. Install gstack:
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack \
  && cd ~/.claude/skills/gstack && ./setup
```

Skills are then available as slash commands (e.g. `/cso`, `/qa`, `/review`, `/browse`).
