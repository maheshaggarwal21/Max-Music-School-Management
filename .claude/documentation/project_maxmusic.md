---
name: project-maxmusic
description: MaxMusic School Platform — white-label multi-tenant music-school SaaS (pure-operator model), locked architecture decisions and non-negotiable rules
metadata:
  type: project
---

# MaxMusic School Platform

> Canonical, always-current specs live in `.claude/`: CLAUDE.md (bootstrap),
> ARCHITECTURE.md (full reference), orchestrate/data-model.md (schemas),
> CONTRACTS.md (API), orchestrate/tasks.md (board). This file is a short orientation —
> if it disagrees with those, those win.

## What We're Building
A **white-label, multi-tenant music-school SaaS**. Max Music School pivoted from running its
own school to being the **invisible operator** behind individual teachers. Each teacher gets a
fully-branded "mini music school" (an **institution**) with admin, teacher, and student panels.

**Why:** students preferred cheaper independent teachers, so Max Music School now brings those
teachers under its umbrella (salary or rent) and sells them the platform.

**How to apply:** two rules dominate every decision —
1. **Isolation:** every `/api/inst/:slug/*` query filters by `institutionId`; cross-institution
   queries only under `/api/operator/*`. A leak is catastrophic for the SaaS.
2. **Shadow:** no "Max Music School" brand/name/domain on any institution panel, email, or URL.

## Pure-Operator Model (the big decision)
There is **no "main school" layer**. Max Music = SaaS operator only. EVERY operational record
(student, teacher, batch, attendance, request, day-pattern, time-slot, payment, audit) belongs
to an institution and carries a **required, indexed `institutionId`**. There is no
`institutionId = null` operating data. The only platform-level account is the superadmin
(`Operator`). One MongoDB, tenant-isolated by the `institutionId` field.

## Tech Stack
```
Backend:   Node.js + Express + MongoDB (Mongoose)
Frontend:  Next.js 14 App Router — 4 panels (operator + institution admin/teacher/student)
Monorepo:  Turborepo · Auth: JWT httpOnly cookies + PBAC (NEVER localStorage)
Payments:  Razorpay (per-teacher links; app tracks, doesn't route) · Real-time: Socket.io
Scheduler: node-cron (daily student-status/validity) · Infra: VPS, PM2, Nginx
```

## Identity & Access — PBAC
The institution admin is NOT a separate account. The owner `Teacher` has one credential and a
`panelAccess` array: `['teacher']` (managed) or `['teacher','admin']` (autonomous). The same
login opens the admin panel once `'admin'` is granted. Superadmin grants/revokes it with one
button — no new credentials. The admin panel exists for ALL institutions; access is PBAC-gated
(managed → superadmin impersonates; autonomous → owner logs in directly).

## Institution Modes (billing) — see the three onboarding scenarios in ARCHITECTURE.md §1
| Mode | Owner gets | Billing |
|------|-----------|---------|
| `managed` | teacher panel only | Max pays salary |
| `autonomous` | admin + teacher panels (same login) | teacher pays rent |
Mode toggle bumps `tokenVersion` (forces re-login) and edits the owner's `panelAccess`.

## Routing
Path-based on a **neutral** `<PLATFORM_DOMAIN>` (never "maxmusic"): `/<slug>/{student|teacher|admin}`.
Operator panel on a separate private `<OPERATOR_DOMAIN>`. Slug is immutable.

## Payments
Student fees: per-teacher Razorpay link; admin sets `paidAmount`/`upcomingAmount` **manually**;
webhook feed is read-only reconciliation. Rent (autonomous) tracked via `RentInvoice`
(operator revenue). Fee amounts are visible on operator + admin panels.

## Non-Negotiables (summary — full list in CLAUDE.md)
1. JWT in httpOnly cookies only; login = password OR mobile OTP (TOTP 2FA removed 2026-06-12).
2. Two-level token invalidation: `Institution.tokenVersion` + `Teacher/Student.tokenVersion`.
3. bcrypt for all passwords; never return password/hash/otp.
4. `auditLog()` on every write, `w:0` — one immutable log powers Changes History + per-student feed.
5. `institutionId` in every institution query; cross-tenant only under `/api/operator/*`.
6. Slug immutable after creation.
7. `Helper.response()` for all responses — never bare `res.json()`.
8. Business logic in controllers, auth in middleware — never crossed.
9. White-label: zero Max Music School identifiers on any institution surface.

## gstack Security Checkpoints
- After Phase 2 (auth/PBAC middleware): `/cso` — non-negotiable.
- After Phase 4 (institution controllers / isolation): `/cso` — non-negotiable.
See [[reference-gstack]] for how to invoke and what context to feed.

## Frontend Design
- Brand accent **Steel Blue `#5B8DEF`** on the operator panel. NO pink anywhere.
- Institution panels theme from `Institution.branding` (CSS variable override).
- Apply [[reference-frontend-design-skill]] principles — avoid generic AI aesthetics.

## Current Phase
Planning complete (architecture/schemas/contracts locked). See `orchestrate/tasks.md`.
