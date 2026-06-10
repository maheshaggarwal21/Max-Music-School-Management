# Operator Panel — Feature Inventory (port 3000, private superadmin domain)

## Routes
| URL | Purpose |
|---|---|
| `/` | redirect → `/login` |
| `/login` | email + password → TOTP 2FA step |
| `/dashboard` | platform stats, fee chart, recent activity |
| `/institutions` | list + filters + Add Institution modal + Panel (impersonate) button |
| `/institutions/[id]` | detail: Overview / Actions / Rent Invoices tabs |
| `/slug-requests` | pending/approved/rejected/all queue, approve/reject |
| `/students` | cross-institution list + EntityEditModal (god-mode) |
| `/teachers` | cross-institution list + EntityEditModal (god-mode) |
| `/payments` | Student Fees tab + Rent Invoices tab (mark-paid) |
| `/changes` | audit timeline, filters, expandable before/after JSON |
| `/settings` | Profile · 2FA · Default Rent · Instruments master list |

## Navigation (sidebar)
Overview: Dashboard · Platform: Institutions, Slug Requests, Students, Teachers ·
Finance: Payments · System: Changes History, Settings. Topbar: theme toggle, avatar
menu (Settings / Sign out → `POST /api/auth/operator/logout`).

## Key clickables per page
- **/login** — email, password, Continue → 2FA: 6-digit OTP input (auto-submit on 6th digit), Verify & sign in, Back to credentials.
- **/dashboard** — 5 stat cards (Institutions, Active Students, Teachers, Fee Collection, Pending Rent), fee AreaChart, recent-activity feed. `GET /api/operator/dashboard`.
- **/institutions** — SearchBar, Mode select (managed/autonomous), Status select (active/pending/suspended/terminated), row-click → detail, **Panel** button (impersonate → opens admin panel new tab, disabled when suspended/terminated), **Add Institution** modal: name (live slug preview), mode, default rent (autonomous only), owner name/mobile/email → `POST /api/operator/institutions`.
- **/institutions/[id]**
  - *Overview*: branding card (logo/color/tagline/contact/owner/rent) + 4 stat cards.
  - *Actions*: PBAC chips + **Grant Admin Access** (managed) / **Revoke Admin Access** (autonomous) with confirm modals (mode flips, tokenVersion bump); **Impersonate** Admin/Teacher/Student panel buttons (god-token); **Danger zone**: Suspend / Reactivate / Terminate (confirm modals).
  - *Rent Invoices*: table (autonomous) or managed-mode empty state.
- **/slug-requests** — tabs Pending/Approved/Rejected/All; per card: slug diff, Approve (confirm: applies instantly, logs out all users) / Reject (optional reason input).
- **/students** — search, institution select, joinStatus select; ⋯ → Edit details → EntityEditModal (name, mobile, joinStatus, validityEnd, paidAmount, upcomingAmount, paidClasses + live activity rail from `GET /api/operator/changes?entityType=Student&entityId=…`) → `PATCH /api/operator/students/:id`.
- **/teachers** — search, institution select, employmentType select; ⋯ → Edit details (name, mobile, salaryAmount, status + activity rail) → `PATCH /api/operator/teachers/:id`. OWNER badge, panelAccess tags.
- **/payments** — *Student Fees*: institution + status filters, read-only table. *Rent Invoices*: **Mark paid** button → confirm modal w/ optional payment reference → `POST /api/operator/rent-invoices/:id/mark-paid` (optimistic + rollback).
- **/changes** — institution / actorRole / date-range filters; timeline cards (colored dot per role, impersonated tag, per-field from→to chips); expandable before/after JSON; prev/next pagination.
- **/settings** — Profile (name/email, Save) · 2FA (Enable → QR + secret + OTP verify / Disable) · Default rent (amount, Save) · Instruments master list (chips with ✕ remove, add input + Add) → `GET/PATCH /api/operator/settings`, `POST …/2fa/{enable,verify,disable}`.

## Core workflows
1. **Login + TOTP 2FA** → dashboard.
2. **Create institution** (managed or autonomous; autonomous asks rent) → appears in list.
3. **Grant/Revoke admin** (scenario 3: salaried → independent; mode flips, owner logged out once).
4. **Suspend / Reactivate / Terminate** institution (tokenVersion bump → whole-institution logout).
5. **Impersonate** any panel via god-token (audited with impersonatedBy).
6. **Approve/Reject slug change** (approve = instant URL change + mass logout).
7. **God-mode edit** student/teacher with live activity rail.
8. **Mark rent invoice paid** (optional reference, audited MARK_RENT_PAID).
9. **Audit trail** browse/filter/expand.
10. **Settings**: profile, 2FA enrol/disable, default rent, instruments master list.
