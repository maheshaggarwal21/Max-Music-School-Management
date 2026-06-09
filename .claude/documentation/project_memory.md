---
name: project-memory
description: Dev B working memory — frontend build state, conventions established in code, mock/handshake patterns, fixes, contract gaps for Dev A, environment notes, remaining work
metadata:
  type: project
---

# Project Memory — Dev B (Frontend · Design System · White-Label)

> Living memory of what has actually been BUILT and the conventions the code follows,
> gathered across Claude Code sessions (last updated **10 Jun 2026**). Specs win over
> this file: [[project-maxmusic]], CLAUDE.md, CONTRACTS.md, orchestrate/tasks.md.
> The checked-in CLAUDE.md says "we are building as Dev A" — **this workspace is Dev B**;
> ignore that role block here.

## Build State (branch `frontend/phase-0-6`, uncommitted)

All Dev B mockable work through Phase 6 is **complete and building green**:

| Deliverable | Status |
|---|---|
| `packages/utils` — formatters (en-IN ₹ from paise, dates, phone), validators, const enums | ✅ |
| `packages/ui` — ~25 components: Button, DataTable, Modal, StatusBadge, StatsCard, Sidebar, SearchBar, Avatar, forms (Input/Select/DatePicker/FileUpload), BlurFade, BorderBeam, SpotlightCard, ShinyText, GradientText, CountUp, Marquee, StarBorder, charts, BrandingProvider, useThemeTransition | ✅ |
| `apps/operator-panel` (port 3000) — login+TOTP 2FA, dashboard, institutions (+detail/actions), students, teachers, payments (fees+rent), changes history, settings | ✅ P5 complete |
| `apps/institution-admin-panel` (3001) — 8 tabs + student detail popup w/ activity feed + operator-view banner | ✅ P6-02 |
| `apps/institution-teacher-panel` (3002) — mobile-first attendance flow, batches, holidays, profile | ✅ P6-03 |
| `apps/institution-student-panel` (3003) — branded dashboard, classes, timetable, payments, profile | ✅ P6-04 |

E2E tested with gstack browser (production builds): 27 routes clean, 8 core flows pass,
zero console errors, white-label greps clean (src + `.next/static` + rendered HTML).
Task board rows P0-04/05, P5-01..09, P6-01..04 marked ✅ in orchestrate/tasks.md.

## Conventions the Code Follows (copy these, don't reinvent)

- **Mock mode**: `NEXT_PUBLIC_API_URL` empty ⇒ `MOCKS_ENABLED`. Every fetch is
  `mockable(() => api.get/post(<real CONTRACTS path>), mockBuilder(...))` — wiring real
  APIs later = delete the second argument. One `src/lib/mocks.ts` per app is the single
  mock home (realistic Indian music-school data, paise amounts, 2026 dates).
- **Types**: each app's `src/lib/types.ts` is a TEMPORARY mirror of CONTRACTS.md with a
  header comment; swap for `@maxmusic/types` imports at Handoff H2. Dev B never writes
  `packages/types`.
- **Workspace packages** ship TypeScript source — consumed via Next `transpilePackages`,
  no build step. App globals.css imports `@maxmusic/ui/styles/globals.css` and MUST keep
  the `@source "../../../../packages/{ui,utils}/src";` lines (tailwind v4 class scanning).
- **Hard rules enforced everywhere**: `motion/react` (never framer-motion);
  `import { Slot } from "radix-ui"` (never @radix-ui/react-slot); httpOnly-cookie auth
  only (never localStorage/sessionStorage); no hardcoded API URLs; no pink/magenta hex;
  brand = Steel Blue #5B8DEF on operator, institution `branding.primaryColor` via
  BrandingProvider CSS vars elsewhere.
- **White-label**: institution panels render brand ONLY from `useBranding()`
  (mock: "Sunrise School of Music"); neutral metadata titles pre-hydration
  ("Admin Panel" / "Teacher Panel" / "Student Portal"). `@maxmusic/*` package
  specifiers are allowed (erased from bundles — verified).

## Feature Implementations Worth Knowing

- **Mock impersonation handshake** (eye "Panel" button on operator /institutions):
  fires `POST /api/operator/institutions/:id/impersonate` via mockable, sets cookie
  `mm_impersonate=encodeURIComponent(slug + "|" + name); path=/` (host-scoped DISPLAY
  HINT, not a token), opens `NEXT_PUBLIC_ADMIN_PANEL_URL || protocol//hostname:3011`
  + `/dashboard`. Admin panel's `operator-banner.tsx` reads the cookie post-mount and
  shows the violet "Operator session — full access to <name>" banner with Exit.
  Swaps to Dev A's god-token flow (P2-07/P3-05) at Handoff H5.
- **Entity edit + live activity rail** (operator /teachers and /students): `⋯ → Edit
  details` opens `entity-edit-modal.tsx` (config-driven fields) with `activity-graph.tsx`
  — node-graph timeline, LIVE pulse, red old → emerald new value chips, actor + role
  badge; on save, per-field events prepend with staggered spring entrance. Mock store:
  `getEntityActivity`/`recordEntityActivity` in operator mocks.ts.
- **Circular theme reveal**: `useThemeTransition()` (packages/ui) — View Transitions API
  clip-path circle expanding from the clicked sun/moon control; reduced-motion + 
  no-support fallbacks; matching `::view-transition-*` CSS in ui globals.css. Wired in
  shared Sidebar, operator Topbar, teacher layout MobileHeader, student mobile-nav.
- **Fixes applied after E2E**: shared CountUp rounds every frame + snappier spring
  (no more "4.864" decimals); recharts -1×-1 first-paint warning killed via
  `initialDimension={{ width: 600, height }}` + mounted guard (ui charts.tsx, operator
  area-chart.tsx); DataTable generic relaxed to `T extends object`.

## Contract Gaps Flagged for Dev A (all have `// CONTRACT GAP` comments in code)

1. Pre-auth public branding endpoint (`GET /api/inst/:slug/branding`) — login pages need it.
2. `PATCH /api/operator/teachers/:id` and `/students/:id` — operator edit modals.
3. `GET /api/operator/changes` needs `entityType`/`entityId` filters — activity rail.
4. Teacher `GET /attendance?batchId=&date=` response shape undefined; `POST /attendance/mark`
   only accepts present|absent (holiday/credited are UI states meanwhile).
5. Admin holidays endpoints; student payments endpoint; reconciliation "match" action;
   2FA verify path; `OperatorSettingsData` shape; `OperatorStudentRow.paidClasses`.

## Environment Notes

- **Local test servers**: operator on **3010**, admin on **3011** (canonical 3000/3001 are
  occupied by the user's separate Reddify project — do NOT kill those node processes);
  teacher 3002, student 3003 as canonical. Login: any well-formed credentials (mock mode);
  operator 2FA accepts any 6 digits.
- **gstack** installed at `~/.claude/skills/gstack` (bun via Homebrew). `/qa`, `/browse`,
  `/cso` etc. available; browse CLI at `~/.claude/skills/gstack/browse/dist/browse`
  (per-repo daemon, state in `.gstack/` — gitignored). E2E screenshots land in
  `/tmp/maxmusic-e2e/`.
- Commits are made by the user personally — agents/sessions leave the tree uncommitted.

## Remaining Dev B Work

- gstack `/qa` passes for P5-R / P6-R; Phase 8 bundle leak audit (`grep` built bundles
  on a neutral build path — local absolute paths contain "maxmusic" only because of the
  repo folder name).
- Handoff H2: swap types mirrors → `@maxmusic/types`. H4/H5: wire real APIs (delete mock
  args), real impersonation, real branding fetch. H3: Socket.io live attendance
  (`// TODO(H3)` markers in teacher panel attendance page).
