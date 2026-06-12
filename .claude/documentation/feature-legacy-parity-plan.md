# Feature Plan — Legacy Parity Round (2026-06-12)

> **STATUS: ✅ BUILT (commits `ef5a38f..d83f65a`) — browser /qa + /cso re-run pending.**
> CRED amendment landed mid-build (user): step-up re-confirm = own password OR OTP to own
> verified mobile (purpose `reset_confirm`); "view current password" replaced by reset-reveal
> (plaintext passwords are irreversible bcrypt — never stored/shown).

Scope locked by user: A1 · A4 · A5 · A7 · A12 · B1 · CRED. (A8 connect icons DROPPED by user mid-build.)
Source inventory: `feature-inventory/legacy-maxmusic-screenshot-inventory.md`.
Design: OUR theme (Steel Blue operator / institution branding), original implementation — no legacy UI copying.

---

## 1. CRED — Credential Manager (main build)

### Architecture
- Hierarchy mirrors existing auth: operator god-mode = cross-institution; admin = institution-scoped via
  existing `resolveInstitution → instAuth('admin') → scopeGuard → panelGuard('admin')` chain. No new middleware.
- **No plaintext passwords ever** (bcrypt). "View credentials" = identifiers only.
  "Forgot password" = reset → cryptographically random temp password returned ONCE in the API response,
  never persisted in plaintext, never logged, never in audit payload.

### Backend — operator (`/api/operator/credentials`)
- `GET /api/operator/credentials` — query: `role` (teacher|student, required), `institutionId` ('all' sentinel ok),
  `q` (name/mobile/email/displayId regex-escaped search), `page/limit`. Paginated. Projection:
  `displayId name email mobile mobileVerified panelAccess status joinStatus lastLoginAt institutionId createdAt`
  (+ populate institution name for the table). Explicitly NEVER `passwordHash/recoveryOtp`.
- `POST /api/operator/credentials/:role/:id/reset-password` — body `{ operatorPassword }`:
  1. bcrypt-verify acting operator's own password (mirrors god-OTP-change pattern) → 400 on mismatch (not 401 — avoids session-expired redirect, lesson from `5112e7c`).
  2. Generate temp password (10 chars, crypto-random, unambiguous charset).
  3. `passwordHash = bcrypt(temp)`, `tokenVersion += 1` (target logged out everywhere).
  4. `auditLog` action `RESET_PASSWORD` (entityType Teacher/Student, label, impersonatedBy n/a, NO password fields).
  5. Respond `{ tempPassword }` once. Rate-limited (reuse `otpRequestLimiter`-style: 10/15min per IP).

### Backend — admin (`/api/inst/:slug/admin/credentials`)
- Same two endpoints, institution-scoped: every query filters `institutionId: req.institution._id`;
  `:id` lookup scoped by institutionId (golden rule). Acting admin re-enters THEIR password (Teacher.passwordHash).
- Admin may reset any teacher/student of own institution (incl. self). God-token impersonation works as-is
  (instAuth bypass) → audit stamps `impersonatedBy`.

### Frontend
- Operator panel: new sidebar tab **Credentials** — filters: institution select ('All'), role toggle
  (Teachers|Students), debounced search; table: name+displayId, institution, email, mobile (+verified badge),
  panel access chips (teachers), status, last login; row action **Reset password** →
  modal: warning ("logs the user out everywhere"), operator password input → success state shows temp password
  with copy button + "shown only once" notice.
- Admin panel: new sidebar tab **Credentials** — same minus institution filter; institution-branded.

### Security checklist
- institutionId on every admin query · refGuard not needed (no client refs) · responses via Helper.response ·
  no hash/OTP fields in any response or audit · rate limit on reset · generic 404 for unknown id ·
  audit on every reset · tokenVersion bump · password-confirm 400 not 401.

---

## 2. A1 — Quick-action cards (frontend only)

- Operator dashboard top section: cards → Add Institution · Institutions list · Students (god view) ·
  Teachers (god view) · Credentials · Settings. Click = navigate (or open existing create modal route).
- Admin dashboard top section: Add Student (request) · Add Teacher · Add Batch · Pending Requests (count badge) ·
  Attendance · Credentials.
- Implementation: one shared presentational pattern per panel (lucide icon + label + sub-line), BlurFade entrance,
  brand accent. No API changes (request count already on dashboard payload — verify; else reuse requests list total).

## 3. A5 — Student "My Plan" card (small backend + frontend)

- Backend `StudentAppController.dashboard`: extend payload — `validity.{days: s.validityDays, upcomingClasses:
  s.upcomingClasses}`, `credentials.{courseStart: s.validityStart}`, `attendedCount` (count of student's
  attendance records). Additive — no contract break (update CONTRACTS.md).
- Frontend student dashboard: new card — Reg ID, weekly schedule, session slot, course start, valid until,
  plan length ("N-day plan"), classes: used X / paid Y (+ upcoming Z if > 0).

## 4. A7 — Teacher extra fields (verification + operator gap)

- Admin panel: ALREADY exposes altMobile/gender/dob/razorpayPaymentLink — verify only.
- Operator panel teacher detail/edit: add the 4 fields if missing (read + god-mode PATCH already audited per-field).

## 5. A8 — DROPPED (user decision 2026-06-12, mid-build)

## 6. A12 — Auto-calc Days/Classes on approve (frontend + tiny logic)

- Approve modal: when start+end dates set → live-derived **Days** (date diff, matches backend `effectiveDays`)
  and **Classes** (count of batch's dayPattern weekdays occurring in [start, end], minus declared holidays —
  v1: weekday count only). Prefill `paidClasses`/`upcomingClasses` suggestion (editable).
- No backend change (approve already accepts explicit values + derives days).

## 7. B1+ — Student "Join class" link (closes the online-class loop)

- Backend: student dashboard `upcomingClass` — when batch.mode === 'online' and a ClassSession exists with
  `targetDate` === that date → include `meetingUrl`. Scoped query `{institutionId, batchId, targetDate}` (covered index).
- Frontend student dashboard: "JOIN CLASS" button on upcoming-class banner when meetingUrl present (opens new tab).
- Teacher launch + archive already live — no change.

---

## Build order (each step = atomic commit, node --check + targeted browser verify)

1. CRED backend operator (routes + controller + limiter + audit action)
2. CRED backend admin
3. CRED frontend operator tab
4. CRED frontend admin tab
5. A1 cards (operator, then admin)
6. A5 payload + student card
7. B1+ join link (backend + student banner)
8. A12 approve modal calc
9. A8 connect icons
10. A7 operator teacher-detail fields (if gap confirmed)
11. CONTRACTS.md + CLAUDE.md + memory update → /qa pass on touched panels

QA constraint: ONE panel dev-server at a time (7.5 GB RAM); kill ports 4000+3000–3003 first.