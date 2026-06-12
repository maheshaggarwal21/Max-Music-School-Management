# Mobile Responsive — all 4 panels (2026-06-13)

> Status: ✅ BUILT — operator + admin `next build` PASS; all 4 apps + `@maxmusic/ui` `tsc --noEmit`
> clean. Browser /qa at mobile width PENDING (pure CSS/layout, no API change). Contributor: this session.

## Problem (user-reported, with screenshots)

The **operator** panel (and **admin**, same cause) was unusable on phones: the shared `@maxmusic/ui`
`<Sidebar>` (`w-60`, in-flow `aside`) was rendered on **every** breakpoint and never collapsed. On a
narrow viewport it ate most of the width and shoved the page content off the right edge — the date header
wrapped, the data tables and filter bars were clipped, the dashboard quick-action cards were sliced.

## Root cause

Only **teacher** and **student** panels had any mobile treatment:
- **teacher** — `<Sidebar className="hidden md:flex">` + a `md:hidden` `MobileHeader` + a bottom-tab
  `MobileNav` (`grid-cols-5`, works because teacher has ≤5 nav items).
- **student** — desktop `<Sidebar>` wrapped in `hidden md:flex` + its own `md:hidden` slide-over
  `MobileNav` (top bar + left drawer).

**operator** and **admin** rendered `<Sidebar>` permanently in-flow with **no hamburger and no drawer**.
They have ~10 and ~13 nav items respectively → a bottom-tab bar doesn't fit; a slide-over drawer is the
right pattern (matches student).

## The fix

### New shared component — `packages/ui/src/components/mobile-sidebar.tsx` (`MobileSidebar`)
A `md:hidden` sticky top bar (brand + hamburger) + a left **slide-over drawer** (overlay + `motion` aside).
- Reuses the existing `SidebarSection`/`SidebarNavItem` types and the Sidebar's active-link look
  (brand accent bar, `theme.shadows`).
- Props mirror `Sidebar`: `brandName`, `logoUrl`, `sections`, `activeHref`, `footer`, `onSignOut`,
  plus an optional `rightSlot` for the top bar. **White-label**: renders only what's passed in.
- Auto-closes on route change (`usePathname`), locks body scroll while open.
- Exported from `packages/ui/src/index.ts` as `MobileSidebar` + `MobileSidebarProps`.

### Operator panel — `apps/operator-panel/src/app/(dashboard)/layout.tsx`
- Desktop `<Sidebar>` → `className="hidden md:flex"`.
- Added `<MobileSidebar brandName="Operator Console" sections={SECTIONS} … />` in the content column.
- `components/topbar.tsx` header → `hidden … md:flex` (the date/avatar bar hides on mobile; the
  hamburger bar + drawer cover nav, theme toggle, and sign-out).

### Admin panel — `apps/institution-admin-panel/src/app/[slug]/admin/(dashboard)/layout.tsx`
- Desktop `<Sidebar>` → `className="hidden md:flex"`.
- Added `<MobileSidebar>` (institution branding + the admin nav sections + an avatar footer).
- `components/top-nav.tsx` header → `hidden … md:flex`.

### Content sweep (all panels)
- **27 fixed-width filter controls** (`className="w-72/64/48/44"` on `SearchBar`/`Select`/`DatePicker`)
  → `w-full sm:w-NN`. Parents are already `flex flex-wrap`, so on mobile each control goes full-width
  and wraps to its own line; from `sm:` up they sit inline at the original width.
  - operator: institutions, changes, payments, teachers, students, credentials (17)
  - admin: attendance, students, credentials (5)
  - teacher: teachers/[id], attendance, dashboard, batches/[id] (5)
  - student: 0 (none present)
- **Top-level page-container padding** `flex flex-col gap-6 p-6` → `… p-4 sm:p-6` — operator's 11 page
  containers + admin's shared `components/page-shell.tsx` (covers all 13 admin pages). Student pages were
  already `p-4 md:p-6`; teacher pages don't use this container.
- **Modal multi-column fee rows** `grid grid-cols-3 gap-3` → `grid grid-cols-1 gap-3 sm:grid-cols-3` —
  operator `add-student-modal` + admin `add-student-dialog`/`approve-request-modal`/`student-detail-modal`.

### Why nothing else needed changing
- The shared `DataTable` already wraps its table in `overflow-x-auto`, and `Modal` is
  `w-full max-h-[90vh]` — both fit once the sidebar collapses.
- Dashboard stat rows / quick-actions already had responsive grids
  (`grid-cols-2 … lg:grid-cols-N`); they only *looked* broken because the sidebar overlapped them.
- The lone student `grid-cols-3` is a row of 3 tiny stat pills — intentional, fits a phone.
- Teacher's `grid-cols-5` is the bottom-nav itself — must stay 5.

## Files changed (28)
- NEW `packages/ui/src/components/mobile-sidebar.tsx`; `packages/ui/src/index.ts` (export)
- operator: `(dashboard)/layout.tsx`, `components/topbar.tsx`, `components/add-student-modal.tsx`,
  + 8 pages (filter widths / page padding)
- admin: `(dashboard)/layout.tsx`, `components/top-nav.tsx`, `components/page-shell.tsx`,
  3 modal components, 3 pages
- teacher: 4 pages (filter widths only)

## Verification
- `@maxmusic/ui` `tsc --noEmit` ✅; all 4 apps `tsc --noEmit` ✅
- `next build` operator ✅ (14 routes) + admin ✅ (18 routes)
- Diff reviewed line-by-line: every page/component change is a responsive-class swap only; the only
  structural edits are the layout/top-bar/index files. No API/contract/data-model change.

## Pattern to reuse (responsive layout invariants)
- Desktop `<Sidebar>` is always `hidden md:flex`; every panel pairs it with a `md:hidden` mobile nav
  (operator/admin = `MobileSidebar` drawer; teacher = bottom-tab; student = own drawer).
- Fixed-width filter controls: `w-full sm:w-NN` inside a `flex flex-wrap` row.
- Page containers: `gap-6 p-4 sm:p-6`. Multi-col form/modal rows: `grid-cols-1 sm:grid-cols-N`.

## Remaining
- Browser /qa at mobile width on all 4 panels (operator + admin login → drawer open/close, table scroll;
  teacher/student regression check). Pure presentational change, so live-API drift risk does not apply.
- Not committed/pushed (no request); user verifies via Vercel redeploy.
