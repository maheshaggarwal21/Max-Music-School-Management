# Legacy maxmusicschool.co.in — Screenshot Feature Inventory (2026-06-12)

Source: 27 screenshots in `max music screenshots/` (client's CURRENT live product).
Purpose: extract features/form-parameters as candidates for OUR platform. We do NOT copy their UI
(pink theme) — our design stays Steel Blue / per-institution branding, original implementation.

---

## 1. STUDENT PANEL (`/student/dashboard`) — dashboard only (per user scope)

Nav tabs seen (OUT of scope): Certificates · Metronome · Guitar Tuner · Guitar Chords · Contact Us.

### Dashboard widgets
- **Upcoming Class banner** — "Be ready for tomorrow's Guitar class at 9:15 PM" (we have equivalent).
- **Change Class Time CTA → "Edit Schedule" modal**:
  - SELECT TIME (pick preferred time) · SELECT DAYS (pick preferred days)
  - Rule shown: "you can only update your schedule once every 2 days; request updated immediately"
  - Button: Update Schedule → lands in admin's request queue
- **Time Table** — dated session list (SAT 13 · Guitar · June 2026 · 9:15 PM …) — we have this.
- **Profile chip block** — avatar, name, badges: `GUITAR` (instrument) + `ONLINE` (mode); verified tick.
- **Stat circles** — attendance % · classes used `3/80` · status `ACTIVE`.
- **Recent Attendance strip** — last 6 sessions as green/red shield icons (Present/Absent legend).
- **Student Credentials card** (read-only):
  - Registration ID (e.g. 103510)
  - Weekly Schedule (TUE·THU·SAT)
  - Session Slot (9:15 PM – 10:15 PM)
  - Course Start (28 Jan 2026)
  - Valid Until (30 Jul 2026)
  - Batch Duration (**184 Days Plan**)
  - Total Sessions (**80 Classes**)
- **REQUEST ASSISTANCE** button (support/assistance request).

---

## 2. TEACHER PANEL (`/teacher/...`)

### Teacher dashboard
- Batch list cards: "Vari 6:00-7:00 PM (MWF) ON" — name encodes time+days+ONline mode; days + slot shown.
- Right rail: **HOLIDAYS feed** — cards "TEACHER ON HOLIDAY" / "TEACHER ON LEAVE" + date + batch; ADD HOLIDAY button; VIEW ALL HOLIDAYS.
- Top nav: TEACHERS · STATS.

### ADD HOLIDAY modal
- Select Date (dd-mm-yyyy) · Select Batch · **Student Category to credit class** (REGULAR / TRIAL checkboxes) · Reason (free text) · Submit. (= our holiday model, parity.)

### Batch detail (`/teacher/batch/:id`) — tabs Overview · Attendance · Students
- **Overview / Launch Session**: "Enter Meeting URI…" input + paste icon + **LAUNCH CLASS** button + Target Date chip (12 Jun).
- **Session Archive** ("10 LOGS TOTAL") — per-session card: `OVER` badge · short id (#D864) · **manifest link (Zoom URL)** · execution date · marking status **"Verified"**.
- **Attendance tab**: **Class Timeline** — 7-day date strip, select a session → analytics cards: TOTAL students · % ABSENT (n stud) · % PRESENT (n stud).
- **Students tab**: FULL ROSTER + count chips: TOTAL · REGULAR · TRIAL · ACTIVE SOON (+ live "UPDATING…" indicator).

---

## 3. ADMIN PANEL (`/admin/dashboard#tab-*`)

Sidebar tabs: New Requests · Students · Teachers · Batches · Batch Analytics · Archive Batches ·
Attendance · Suitable Days · Suitable Times · Trail Script · Report · Video Chapters · Video Sessions ·
Users · Announcements · Webhooks · Trial Call AI.

### New Requests queue
- Search by student name/email · **+ Add Student** button · "Show 50 rows" · total records · pagination.
- Columns: IDENTIFICATION (name+email) · **PREFERENCE (preferred days + time)** ·
  **CONNECT (quick-action icons: email / phone / WhatsApp)** · USER STATUS (PENDING + reg date) ·
  PAYMENT (Online / UNPAID).

### Request Details modal (approval form — full field list)
- Instrument* · Mode* (Online/…) · Session Type* (Live/…) · **Video Chapter (Optional — "No Chapter (Use Class Type Logic)")**
- Join Status* (Active/…) · Class Type* (Trial/Regular) · Payment Status* (Pending/…)
- Teacher (select) · Batch Name/Code* (select)
- Start Date* · End Date* · **Days (Calculated)** · **Classes (Calculated)** — auto-derived from date range
- **Employee Name/Code** (processing staff member) · Cancel / Update Request

### Students tab
- Columns: IDENTIFICATION (id + enrol date) · USER STATUS (name + id) · CLASS (Guitar · Trial) ·
  PREFERENCE (days + slot) · VALIDITY (end date + slot) · STATUS (Active / **Active Soon** chips) ·
  TEACHER (name + teacher code). 7,441 records, paginated.

### Student detail modal
- Header: name, status chip, mobile, email, icons: Edit / WhatsApp / call.
- Info row: Recovery Key(?) · Current Course "Trail (Guitar)" · Schedule (Mon-Wed-Fri 5–6 PM) ·
  **Validity "14 Jun – 20 Jun 2026 (7d)"** (remaining-days count) · Classes (remaining).
- COURSE CONFIGURATION: Mode · Join Status · Session Type · **Assigned Video Chapter** · Instrument · Class Type.
- BATCH & SCHEDULE: Teacher · Batch Name/Code.
- **RECENT ACTIVITY feed inline** — "JOIN STATUS changed from 'Active' to 'Active Soon' by System",
  "UPCOMING AMOUNT changed from '0' to '5997' by 'Geeta'" (= our AuditLog activity feed, parity).

### Add Student modal (creates a request)
- Full Name* · Mobile Number* · Email Address* · **Preferred Days*** · **Preferred Time*** · Submit Request.

### Teachers — Add/Edit Teacher modal
- Full Name* · Mobile* · **Alt Mobile*** · Email* · **Gender*** (Male/Female) · **Date of Birth*** ·
  **Payment Link*** (e.g. `https://rzp.io/l/...` / Stripe) — per-teacher payment URL.

### Batches tab
- Search by batch name · + Add Batch · TOTAL BATCHES 55.
- Columns: S# · Batch Name (free text, e.g. "Setting 9:00-9:30 PM (MTWTFS)") · Instrument · Days ·
  Time · Teacher ("Not Assigned (Setting Phase)") · **Status toggle (on/off)** · Edit.
- Add/Edit Batch modal: Batch Name* · Instrument* · Class Days* · Class Time* · Select Teacher (Optional).

### Users tab — "USER MANAGEMENT · Platform Access & Privilege Engine"
- Staff sub-accounts table: Identity (name+id) · Email · Password (masked) · ACCESS ROLE (SUPER ADMIN / USER) ·
  Status (ACTIVE/INACTIVE) · Registration Date · Edit. "14 total identities".
- ADD/UPDATE USER modal: Full Name* · Email* · Password* (min 6) · SYSTEM STATUS (Active/Inactive) ·
  **ACCESS RANK (Super / Admin / User)** · **MODULE PRIVILEGES checkboxes**: New Request · Students ·
  Teachers · Suitable Days · Suitable Times · Batches · Archive Batches · Attendance (+ Select All).

### Webhooks tab — Razorpay
- KPI cards: **Total Events 839 · Payments Captured 839 · Payments Failed 0 · Total Captured ₹4,07,769**.
- Filter: All Events dropdown + **search by payment ID / order ID / email / phone** + Refresh.
- Table: Received At · Event (payment.captured chip) · Name · Payment ID · Amount · Contact (phone+email) · Status (processed).
- **Event detail drawer**: Event · Status · Name · Amount · Currency · Payment ID · Order ID · Contact · Email · RAW PAYLOAD (JSON).

### Other sidebar items (not screenshotted in depth)
- Batch Analytics · Archive Batches · Attendance · Report · Announcements · Video Chapters ·
  Video Sessions · Trail Script · Trial Call AI.

---

## 4. CANDIDATE FEATURES FOR OUR PLATFORM (decision checklist)

### A. Recommended — in scope, high value/low effort
| # | Feature | Notes |
|---|---|---|
| A1 | **Quick-action cards on panel landing** (user's idea) — operator: Add Institution, Impersonate, …; admin: Add Student, Add Teacher, Add Batch, Approve Requests | Pure frontend; helps non-tech users |
| A2 | **Student schedule-change request** — student picks preferred days+time → request to admin queue; cooldown (e.g. once/2 days) | New request type; fits our request architecture |
| A3 | **Student "Request Assistance"** — assistance ticket to admin | Can share the request model with A2 |
| A4 | **Preferred Days/Time on enrollment** — fields on EnrollmentRequest + admin Add Student form, shown in requests queue | Aligns with SuitableDays/Times |
| A5 | **Student "My Plan" credentials card** — Reg ID, weekly schedule, slot, course start, valid until, plan duration, total sessions, classes used | Mostly existing data, dashboard widget |
| A6 | **Recent-attendance strip** (last N sessions, present/absent icons) on student dashboard | Frontend only |
| A7 | **Teacher extra fields** — gender, DOB, alt mobile, **per-teacher Payment Link** | paymentLink matches our Razorpay per-teacher-link architecture |
| A8 | **Connect quick actions** — tel: / mailto: / wa.me icons on admin student/request rows | Tiny |
| A9 | **Webhook feed UI upgrade** — KPI cards, search (payment/order/email/phone), raw-payload detail drawer | Backend feed already exists |
| A10 | **Batch active/disabled status toggle** | Small schema+UI |
| A11 | **Per-session attendance analytics** — date-strip timeline → total/present%/absent% cards | Data exists |
| A12 | **Auto-calculated Days/Classes on approve** — start+end date → derived day count + class count from batch day-pattern | Helper logic in approve form |

### B. Decision needed — bigger scope
| # | Feature | Notes |
|---|---|---|
| B1 | **Online-class support** — batch `mode` (online/offline), teacher Launch Session (meeting URI) + Session Archive (links, dates, status) | Their core flow is Zoom-based; ours models physical. Medium effort |
| B2 | **Module-level staff RBAC** — admin sub-users w/ access rank + per-module privileges | New model + middleware; valuable for big institutions; could defer |
| B3 | **Announcements** — admin broadcast to students/teachers | New model + UI; moderate |
| B4 | **Report tab** (exports) | Detail unknown — ask client what reports they use |
| B5 | **Batch Analytics tab** | Not screenshotted; we already have some analytics |

### C. Skip — out of scope (recommend)
- Video Chapters / Video Sessions (recorded-content library + chapter assignment)
- Trial Call AI · Trail Script
- Student tool tabs: Certificates, Metronome, Guitar Tuner, Guitar Chords (dashboard-only mandate)
- Their pink UI/theme (explicitly not copying)

---

## 5. Status — DECISIONS FINAL (2026-06-12)

**Included:** A1, A4, A5, A7, A8, A12, B1, + NEW **CRED** (credentials manager, see below).
**Dropped:** A2, A3, A6, A9, A10, A11. **Deferred:** B2 (staff RBAC). **Skipped:** B3, B4, B5, all C.

**CRED — Credential Manager (user-requested, inspired by legacy Users tab):**
- Tabs on BOTH operator panel (cross-institution) and admin panel (own institution only).
- Hierarchy: operator → all teachers+students everywhere; admin → teachers+students of own institution.
- View login identifiers (displayId, email, mobile+verified, panelAccess, status, lastLogin) — NEVER passwords
  (legacy shows plaintext passwords = critical vuln; ours are bcrypt-hashed, irreversible).
- "Forgot password" served by **reset → one-time temp password reveal** (audited, tokenVersion bump = target logged out).
- Filters: institution (operator only), teacher/student role, name/mobile/email/ID search.

**Pre-plan code audit findings:**
- A4 ALREADY DONE — `EnrollmentRequest.preferredDayPatternId/TimeSlotId` + admin add-student form + queue "Preferred Slot" column all live.
- A7 ALREADY DONE (admin) — `Teacher.altMobile/gender/dob/razorpayPaymentLink` in model + admin teachers page; verify operator detail exposure.
- B1 ALREADY DONE (core) — `Batch.mode`, `ClassSession` (meetingUrl/targetDate/launchedBy), teacher launch+archive QA-verified.
  Gap: student has no way to reach the meeting link → add "Join class" on student dashboard for online batches.
- A12 backend half-done — approve derives `effectiveDays` from start/end; missing: frontend auto-calc display + classes-count from day-pattern.
- A5 backend mostly done — dashboard returns credentials/validity/paidClasses; add validityDays, upcomingClasses, attended count.

Plan: `documentation/feature-legacy-parity-plan.md`
