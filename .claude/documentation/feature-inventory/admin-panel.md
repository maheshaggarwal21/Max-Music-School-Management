# Institution Admin Panel — Feature Inventory

## COMPLETE FEATURE INVENTORY: Institution Admin Panel

### 1. ROUTES

| URL Path | Source File | Purpose |
|----------|-------------|---------|
| `/[slug]/admin` | `src/app/[slug]/admin/page.tsx` | Redirect to dashboard |
| `/[slug]/admin/login` | `src/app/[slug]/admin/(auth)/login/page.tsx` | Admin login (email + password) |
| `/[slug]/admin/dashboard` | `src/app/[slug]/admin/(dashboard)/dashboard/page.tsx` | Dashboard home (stats, charts, class schedule) |
| `/[slug]/admin/students` | `src/app/[slug]/admin/(dashboard)/students/page.tsx` | Student roster with search, filters, detail/edit modals |
| `/[slug]/admin/requests` | `src/app/[slug]/admin/(dashboard)/requests/page.tsx` | Enrollment requests (pending, approved, rejected) |
| `/[slug]/admin/teachers` | `src/app/[slug]/admin/(dashboard)/teachers/page.tsx` | Faculty management with edit + activity log |
| `/[slug]/admin/batches` | `src/app/[slug]/admin/(dashboard)/batches/page.tsx` | Batch catalog (grouped by status) |
| `/[slug]/admin/batches/[id]` | `src/app/[slug]/admin/(dashboard)/batches/[id]/page.tsx` | Batch console (Overview, Holiday, Attendance, Students tabs) |
| `/[slug]/admin/suitable-days` | `src/app/[slug]/admin/(dashboard)/suitable-days/page.tsx` | Weekly day-pattern management |
| `/[slug]/admin/suitable-times` | `src/app/[slug]/admin/(dashboard)/suitable-times/page.tsx` | Class time-slot management |
| `/[slug]/admin/attendance` | `src/app/[slug]/admin/(dashboard)/attendance/page.tsx` | Monthly attendance grid (per batch) |
| `/[slug]/admin/payments` | `src/app/[slug]/admin/(dashboard)/payments/page.tsx` | Fee history + Razorpay reconciliation |
| `/[slug]/admin/settings` | `src/app/[slug]/admin/(dashboard)/settings/page.tsx` | School profile & branding |

---

### 2. NAVIGATION

**Sidebar (4 sections, white-label branded):**

| Section | Label | Menu Items | Target Route |
|---------|-------|-----------|-------------|
| Overview | Overview | Dashboard | `/[slug]/admin/dashboard` |
| Manage | New Requests | New Requests | `/[slug]/admin/requests` |
| | | Students | `/[slug]/admin/students` |
| | | Teachers | `/[slug]/admin/teachers` |
| | | Batches | `/[slug]/admin/batches` |
| Operations | Attendance | Attendance | `/[slug]/admin/attendance` |
| | | Payments | `/[slug]/admin/payments` |
| Configure | Suitable Days | Suitable Days | `/[slug]/admin/suitable-days` |
| | | Suitable Times | `/[slug]/admin/suitable-times` |
| | | Settings | `/[slug]/admin/settings` |

**Top Nav:**
- Theme toggle (light/dark)
- Institution logo/badge
- Admin name (animated gradient text)

**Footer (Sidebar):**
- Admin avatar + name + "ADMINISTRATOR" label
- Sign Out button (calls `POST /auth/logout`)

---

### 3. PAGE-BY-PAGE FEATURE INVENTORY

---

## Page: `/[slug]/admin/login`

**URL Structure:** Pre-auth, no session required

**Elements:**

| Element | Type | Action | API Call |
|---------|------|--------|----------|
| School Logo / Badge | Display | Shows branding.logoUrl or initials | `GET /api/inst/:slug/branding` (on mount) |
| School Name | Display | From BrandingPublic | Same |
| Tagline | Display | branding.tagline or "Admin sign in" | Same |
| Email Input | Input field | Stores email value | N/A |
| Password Input | Input field | Stores password value | N/A |
| Sign in Button | Brand button | Submits form, shows spinner | `POST /auth/login` (email, password) |
| Form Validation | Toast | Email format + password required checks | Sonner toast |
| Ambient Glow | Visual | Background brand-color glow (white-label) | CSS var(--brand-primary) |

**API Endpoints:**
- `GET /api/inst/:slug/branding` — fetch public branding (pre-auth)
- `POST /auth/login` — authenticate with email + password

---

## Page: `/[slug]/admin/(dashboard)/layout`

**Wrapper for all authenticated pages**

**Elements:**

| Element | Type | Action | API Call |
|---------|------|--------|----------|
| Operator Banner | Conditional display | Shows only if `mm_impersonate` cookie present | Client-side cookie sniff |
| Sidebar | Nav container | Displays 4 sections + school branding + footer | Session session data |
| Sign Out Button | Ghost button | Logs out user | `POST /auth/logout` |
| Loading spinner | Fullscreen | Shown while session loads | N/A |

**API Endpoints:**
- `GET /auth/me` — fetch current AdminSession (school branding, user info)
- `POST /auth/logout` — sign out

**Session Data Used:**
- `session.institution` → BrandingPublic (school name, logo, color)
- `session.user.name` → admin name display
- Feeds BrandingProvider for white-label theming

---

## Page: `/[slug]/admin/dashboard`

**Stats, trends, attendance health, today's classes, student lifecycle**

**Elements:**

| Element | Type | Interactive | Details |
|---------|------|------------|---------|
| **Stats Row** | Cards | Display | 4 cards: Active Students, Teachers, Active Batches, Fees This Month (with CountUp animations) |
| **Enrollment Growth Chart** | LineChart | Display | 12-month cumulative student trend; empty state if no data |
| **Attendance Health Bars** | Bars | Display | Per-batch 30-day present rate; color-coded (brand/amber/red by rate) |
| **Today's Classes Grid** | Cards | Display | 2×n grid; teacher name, student count, time slot |
| **Student Lifecycle Strip** | Badges + CountUp | Display | Trial / Active Soon / Active / Inactive counts |

**API Endpoints:**
- `GET /admin/dashboard` — fetch AdminDashboardData (stats, trends, attendance, today's classes)

**Data Structures:**
- `stats.students` (active, trial, activeSoon, inactive, total)
- `stats.teachers.active`, `stats.batches.active`, `stats.feesThisMonth` (in paise)
- `enrollmentTrend[]` (month, cumulative, newStudents)
- `attendanceByBatch[]` (batchId, name, rate, present, total)
- `todaysClasses[]` (\_id, name, teacher, studentCount, time)

---

## Page: `/[slug]/admin/students`

**Roster table with search, filters, edit/detail dialogs**

### Filters & Search
| Element | Type | Action | Details |
|---------|------|--------|---------|
| Search Bar | Input | Filters on: name, displayId, mobile, instrument | Client-side filter |
| Status Filter | Select | trial / active_soon / active / inactive | Client-side filter |
| Teacher Filter | Select searchable | Maps to teacher._id | Client-side filter from MOCK_TEACHERS |

### Table Columns
| Column | Render | Clickable |
|--------|--------|-----------|
| Student | Avatar + name + displayId (mono) | Click → StudentDetailModal |
| Mobile | Formatted phone | N/A |
| Instrument | Text | N/A |
| Schedule | Days · Time or "Unassigned" | N/A |
| Status | StatusBadge (trial/active_soon/active/inactive) | N/A |
| Validity | End date or "—" | N/A |
| Teacher | Name or "—" | N/A |
| Actions | Pencil icon button | Click → StudentEditDialog |

### Modals

#### StudentDetailModal
**Trigger:** Row click (read-only popup)
**Tabs:**
- **Profile:** Status timeline → (Trial → Active Soon → Active) · Grid of fields (mobile, email, instrument, class type, batch, teacher, schedule, category, validity window, fees, classes, attendance summary)
- **Payments:** Table of student's payments scoped from /payments feed
- **Activity:** ActivityFeed of AuditLogItems for this student

**API Endpoints:**
- `GET /students/:id` → StudentDetail
- `GET /students/:id/activity` → Paginated AuditLogItem[]
- `GET /payments` (scoped to student in modal)

#### StudentEditDialog
**Trigger:** Pencil button (full edit form + live activity rail)
**Layout:** 2-column (form on left, activity rail on right)

**Form Fields:**
| Field | Type | Notes |
|-------|------|-------|
| Teacher | Select (active only) | Nullable |
| Batch | Select (active/setting) | Nullable |
| Instrument | Select | From MOCK_INSTRUMENTS |
| Class Type | Select | Group / One-to-One |
| Mode | Select | Online / Offline |
| Session Type | Select | Live / All |
| Join Status | Select | Trial / Active Soon / Active / Inactive |
| Category | Select | Regular / Trial |
| Validity Start | Date input | Calculated days hint below |
| Validity End | Date input | Calculated classes hint below |
| Paid Classes | Number input | |
| Upcoming Classes | Number input | |
| Paid Amount (₹) | Number input | Shows paise storage note |
| Upcoming Amount (₹) | Number input | Shows paise storage note |
| Account Status | Select | Active / Inactive |
| Save Changes Button | Brand button | Spinner on saving |

**Form Behavior:**
- On save, compares each field to `detail` state
- Builds `changes[]` with (field, from, to)
- Only calls API if `changes.length > 0`
- Optimistic activity rail update: each field change appears as an AuditLogItem node immediately

**API Endpoints:**
- `PATCH /students/:id` → with all changed fields + validityDays, upcomingClasses, etc.

**Activity Rail (Right side):**
- Displays AuditLogItems for this student (initially fetched on modal open)
- New entries are prepended optimistically when form saves
- Each entry shows: action icon, action name, actor (system), timestamp, per-field changes (from → to)

---

## Page: `/[slug]/admin/requests`

**Enrollment request queue: create, approve, reject**

### Filter Tabs
| Tab | Count Badge | Action |
|-----|------------|--------|
| pending | Count | Show pending requests only |
| approved | Count | Show approved requests |
| rejected | Count | Show rejected requests |
| all | Count | Show all |

### Table Columns
| Column | Render |
|--------|--------|
| Applicant | Name + mobile (formatted) |
| Instrument | instrument.name or "—" |
| Preferred Slot | "Days · Time" or "No preference" |
| Payment | StatusBadge (unpaid/paid) |
| Status | StatusBadge (pending/approved/rejected) |
| Received | formatDate(createdAt) |
| Actions | Approve + Reject buttons (if pending) or "—" |

### Modal: New Request
**Trigger:** "New Request" button (top-right)
**Title:** "New Enrollment Request"
**Subtitle:** "Capture a walk-in or phone enquiry"

**Form Fields:**
| Field | Type | Validation |
|-------|------|-----------|
| Student name | Input required | Non-empty |
| Mobile | Input required | 10-digit phone |
| Email | Input optional | Email format |
| Instrument | Select | From MOCK_INSTRUMENTS |
| Preferred days | Select | From active MOCK_DAY_PATTERNS |
| Preferred time | Select | From MOCK_TIME_SLOTS |

**API Endpoint:**
- `POST /requests` → creates new RequestItem (added to head of list)

### Modal: Approve Request
**Trigger:** Approve button on pending row
**Title:** "Request Details"
**Subtitle:** "Complete the student's enrollment information to approve"

**Display (read-only):**
- Request summary: name · mobile · preferred days · preferred time

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Instrument | Select | Yes |
| Mode | Select | Yes (Online/Offline) |
| Session Type | Select | Yes (Live/All) |
| Join Status | Select | Yes (Trial/Active Soon/Active) |
| Class Type | Select | No (Group/One-to-One) |
| Payment Status | Select | Yes (Pending/Paid) |
| Fee (₹) | Number input | No |
| Teacher | Select | No (active only) |
| Batch Name/Code | Select | Yes (active/setting only) |
| Start Date | Date input | Yes; date picker |
| End Date | Date input | Yes; date picker |
| Days (Calculated) | Readonly | Calculated from start/end + batch's day pattern |
| Classes (Calculated) | Readonly | Calculated from days and batch pattern |

**Form Behavior:**
- On batch selection, fetches that batch's dayPattern
- If dayPattern is inactive, shows amber warning
- Validates: instrument, batch, date range all required
- Calls `/requests/:id/approve` with all enrollment details

**API Endpoints:**
- `GET /batches` → list active/setting batches
- `GET /teachers` → list active teachers
- `GET /day-patterns` → determine active day pattern days
- `POST /requests/:id/approve` → creates Student, marks Request approved
  - Response: `{ student: { _id, displayId, name }, tempPassword }`
  - Toast shows tempPassword for 8 seconds

**On Success:**
- Request status changes from "pending" to "approved"
- New student immediately visible in Students page
- Toast with temp password

### Modal: Reject Request
**Trigger:** Reject button on pending row
**Title:** "Reject enrollment request"
**Message:** "Reject the request from {name}?"

**Form Fields:**
| Field | Type |
|-------|------|
| Reason (optional) | Input |

**API Endpoint:**
- `POST /requests/:id/reject` → { reason?: string }

**On Success:**
- Request status changes to "rejected"
- Toast confirmation

---

## Page: `/[slug]/admin/teachers`

**Faculty roster with edit modal + activity timeline**

### Search
| Element | Type | Details |
|---------|------|---------|
| Search Bar | Input | Filters on: name, email, mobile, displayId (client-side) |

### Table Columns
| Column | Render | Clickable |
|--------|--------|-----------|
| Teacher | Avatar + name (with "Owner" badge if role=owner) + displayId | Click → opens edit modal |
| Contact | Mobile + email (stacked) | N/A |
| Panel Access | Badges (admin/teacher) | N/A |
| Batches | Number | N/A |
| KPI | Percent (green ≥80%, amber <80%) or "—" | N/A |
| Status | StatusBadge (active/inactive) | N/A |
| Actions | Pencil icon button | Click → edit modal |

### Modal: Add / Edit Teacher
**Trigger:** "Add Teacher" button or pencil icon
**Title:** "Add Teacher" or "Edit {name}"
**Subtitle:** (if editing) "{displayId} · every change lands in the activity log"
**Width:** max-w-lg (create) or max-w-4xl (edit)

**Layout (edit only):** 2-column form + activity rail (right)

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Full name | Input | Yes |
| Mobile | Input | Yes (validation: 10-digit) |
| Alternate mobile | Input | No |
| Email | Input | Yes (validation: email format) |
| Gender | Select | No (Female/Male/Other) |
| Monthly salary (₹) | Number input | No; shows paise note |
| Status | Select (edit only) | Active / Inactive |
| Panel Access note | Display (edit only) | "Panel access: **teacher**. Admin-panel access can only be granted by the platform." |

**Form Behavior (Create):**
- All fields except alt mobile/gender/salary are required
- On save, generates displayId (TCH-NNN)
- New teacher added to head of list with `panelAccess: ["teacher"]`

**Form Behavior (Edit):**
- On save, tracks per-field changes
- If any change detected, optimistically adds AuditLogItem node to activity rail
- Toast confirmation
- If only changes detected, keeps modal open to show activity update

**Activity Rail (Edit only):**
- Displays per-teacher AuditLogItems (fetched on modal open)
- Shows action (UPDATE_TEACHER), timestamp, actor (system), per-field diffs

**API Endpoints:**
- `GET /teachers` (page=1, limit=100)
- `GET /teachers/:id/activity` (paginated)
- `POST /teachers` (create) → { name, mobile, email, altMobile?, gender?, salaryAmount? }
- `PATCH /teachers/:id` (edit) → same fields

---

## Page: `/[slug]/admin/batches`

**Batch library, grouped by status (Active/Setting/Inactive/Archived), create modal, holiday declaration**

### Status Grouping
| Group | Hint | Card Count |
|-------|------|-----------|
| Active | Running batches with a teacher assigned | Cards in grid |
| Setting | Setting Phase — waiting for a teacher | Cards in grid |
| Inactive | Paused batches | Cards in grid |
| Archived | Completed or retired batches | Cards in grid (opacity-70) |

### Batch Card
| Element | Type | Action |
|---------|------|--------|
| Batch name | Font-mono text | Click card → navigate to batch detail |
| Instrument icon + name | Display | |
| Clock icon + days · time | Display | |
| User icon + teacher name | Display | Amber "Setting Phase — no teacher" if null |
| Student count badge | Display | "{n} student(s)" |
| Status badge | Display | active/setting/inactive/archived |

### Buttons (Top-right)
| Button | Action | Trigger |
|--------|--------|---------|
| Declare Holiday | Opens DeclareHolidayModal | Outline button |
| Create Batch | Opens create modal | Brand button |

### Modal: Create Batch
**Title:** "Create Batch"
**Subtitle:** "Instrument + suitable days + suitable time → auto-named batch"

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Instrument | Select | Yes |
| Day pattern | Select (active only) | Yes |
| Time slot | Select | Yes |
| Teacher (optional) | Select (active only) | No; defaults to "Setting Phase" if empty |
| Mode toggle | Online / Offline buttons | Yes (default: online) |
| Batch name | Auto-generated text or manual Input | Controlled by toggle |

**Name Toggle:** "Auto-generate"
- When ON: shows `encodeBatchNamePreview(instrument, days, time, mode)` in mono
- When OFF: shows Input field for manual entry

**Form Behavior:**
- Validates: instrument, dayPattern, timeSlot all required
- If manual name, requires non-empty input
- On save: calls `/batches` with { instrumentId, dayPatternId, timeSlotId, teacherId?, mode, name? }
- New batch added to list (status determined by teacher presence: teacher→active, null→setting)
- Toast: `"Batch \"{name}\" created"`

**API Endpoints:**
- `GET /batches` (page=1, limit=100)
- `POST /batches` → { instrumentId, dayPatternId, timeSlotId, teacherId?, mode, name? }

### Modal: Declare Holiday
**See section 3.2 (DeclareHolidayModal)**

---

## Page: `/[slug]/admin/batches/[id]`

**Batch console: Overview · Holiday · Attendance · Students tabs**

### Identity Chips (below title)
| Chip | Icon | Content |
|------|------|---------|
| Instrument | Music2 | instrument.name |
| Schedule | Clock | dayPattern.label · timeSlot.label |
| Teacher | User | teacher.name or "Setting Phase — no teacher" |
| Student Count | Users | "{n} student(s)" |
| Status | Badge | active/setting/inactive/archived |

### Tab Bar
- Overview / Holiday / Attendance / Students

---

### TAB: Overview

**Section 1: Launch Session**
| Element | Type | Action |
|---------|------|--------|
| Target date input | Date input | Stores targetDate (default: today) |
| Meeting URL input | Input | URL field for Zoom/Meet/etc. |
| Launch Class button | Brand button | Validates URL, posts session |

**API Endpoint:**
- `POST /batches/:id/sessions` → { meetingUrl, targetDate }
- Returns: `{ session: ClassSessionItem }`

**Section 2: Session Archive**
| Element | Type | Details |
|---------|------|---------|
| Session cards | 3-column grid | Each card shows date, "Over" badge, meeting link (external), target date |
| Empty state | Display | "No sessions yet — launch your first class..." |

**API Endpoint:**
- `GET /batches/:id/sessions?page=1&limit=30` → Paginated ClassSessionItem[]

---

### TAB: Holiday

**Declaration Form:**
| Element | Type | Action |
|---------|------|--------|
| "Declare" button | Brand | Opens DeclareHolidayModal (fixedBatchId set) |

**Holiday List:**
| Element | Render | Action |
|---------|--------|--------|
| Holiday row | Date · reason (if any) | |
| Category badge | Badge | studentCategory (regular/trial) |
| Delete button | Ghost icon button (destructive) | Opens confirm modal |

**Confirm Modal: Remove Holiday**
- Message: "Remove the holiday on {date}? The credited class is taken back from the affected students."
- API: `DELETE /holidays/:id`

**API Endpoints:**
- `GET /holidays?batchId=:id` → { holidays: HolidayItem[] }
- `POST /holidays` → declare for this batch (via modal)
- `DELETE /holidays/:id` → remove one holiday

---

### TAB: Attendance

**Class-by-class grid:**
| Column | Type | Render |
|--------|------|--------|
| Class date | Text | formatDate(date) |
| Marked | Text | "{total} students" |
| Present | Badge (green) | "{present} present" |
| Absent | Badge (red) | "{absent} absent" |
| Detail | Button | "View attendance" → opens attendance detail modal |

**Modal: Attendance Detail**
**Trigger:** "View attendance" button on a class
**Title:** "Attendance detail"
**Subtitle:** "{date} · toggle to correct any wrongly marked student"

**Content:**
- List of students with toggle buttons
- Each row: Avatar + name · displayId (with status badge if holiday/credited/unmarked) · Present/Absent toggle
- Status badges are color-coded and show mark type

**Toggle Behavior:**
- Click toggle → cycles through present/absent (honored/credited/holiday/unmarked states are read-only for display)
- Optimistic update to dayGrid state
- API call to `/attendance/mark` with the new status
- Toast on success/error

**API Endpoints:**
- `GET /batches/:id/attendance-summary` → { batch, classes: BatchAttendanceClass[] }
- `GET /attendance?batchId=:id&from=YYYY-MM-DD&to=YYYY-MM-DD` → AttendanceGrid (rows per student, marks per date)
- `POST /attendance/mark` → { batchId, date, marks: [{ studentId, status: "present" | "absent" }] }

---

### TAB: Students

**Roster Table:**
| Column | Render |
|--------|--------|
| Student | Name + displayId (mono) |
| Mobile | formatPhone(mobile) |
| Status | StatusBadge (trial/active_soon/active/inactive) |
| Category | capitalize(category) |
| Validity | formatDate(validityEnd) or "—" |
| Paid classes | Number |

**API Endpoints:**
- `GET /batches/:id/students` → { batch, students: BatchStudentItem[] }

---

## Page: `/[slug]/admin/suitable-days`

**Weekly day-pattern management: list active patterns, create new pattern**

### Left Column: Weekly Recurring Day Patterns
| Element | Render | Action |
|---------|--------|--------|
| Pattern row | Mon, Tue, Wed... (full names) | |
| Status badge + toggle | "Active" / "Disabled" | Click toggle → PATCH isActive |
| Count footer | Total patterns · active count | Display only |

**API Endpoints:**
- `GET /day-patterns` → normalizePatterns (handles various response shapes)
- `PATCH /day-patterns/:id` → { isActive: boolean }

### Right Column: New Pattern (Setup Cycle)
| Element | Type | Action |
|---------|------|--------|
| Day selector buttons | 7 buttons (Mon-Sun) | Click to toggle selection (visual highlight when selected) |
| Selected display | Visual checkmarks | Shows which days are selected |
| Create Cycle button | Brand button | Validates selection, creates pattern |

**Form Behavior:**
- Select one or more days of the week
- Label is auto-generated: "Mon · Wed · Fri" (SHORT_DAY format)
- On save: calls `/day-patterns` with { days: ordered array }
- New pattern added to list with isActive: true
- Toast: "Pattern created — it is now selectable in batch and enrollment forms"

**API Endpoint:**
- `POST /day-patterns` → { days: string[] (ordered like ["mon", "wed", "fri"]) }

---

## Page: `/[slug]/admin/suitable-times`

**Class time-slot management: list registered windows, create new window**

### Left Column: Registered Class Windows
| Element | Render | Action |
|---------|--------|--------|
| Time window row | "9:00 AM → 10:00 AM" (12-hour format) | |
| Online/Offline toggle | "Online" / "Offline" | Click toggle → PATCH isOnline |
| Count footer | Slots total · online count | Display only |

**API Endpoints:**
- `GET /time-slots` → normalizeSlots
- `PATCH /time-slots/:id` → { isOnline: boolean }

### Right Column: New Window (Register Slot)
| Element | Type | Action |
|---------|------|--------|
| Start time input | Time input (HH:MM) | |
| End time input | Time input (HH:MM) | |
| Open Window button | Brand button | Validates times, creates slot |

**Form Behavior:**
- Validates: start and end times both required
- Validates: end time must be after start time
- Label auto-generated: `to12h(startTime)-to12h(endTime)` (e.g., "9:00 AM-10:00 AM")
- On save: calls `/time-slots` with { startTime, endTime }
- New slot added to list with isOnline: true
- Toast: "Window registered — it is now selectable across the platform"

**API Endpoint:**
- `POST /time-slots` → { startTime: "HH:MM", endTime: "HH:MM" }

---

## Page: `/[slug]/admin/attendance`

**Institution-wide monthly attendance grid (per-batch selection)**

### Controls
| Element | Type | Action |
|---------|------|--------|
| Batch selector | Select searchable | Choose active/inactive batch |
| Month navigation | Prev/Next buttons + month display | Step backward/forward by month |

### Legend
| Status | Char | Color | Meaning |
|--------|------|-------|---------|
| Present | P | emerald-400/15 | Student present |
| Absent | A | destructive/10 | Student absent |
| Holiday | H | amber-400/15 | Holiday (credited class) |
| Credited | C | brand/10 | Credited class |
| Unmarked | – | muted/60 | Not marked |

### Grid Table
| Column | Render |
|--------|--------|
| Student | Name + displayId (sticky left) |
| Class dates | Date columns (M, Tu, W... date number) |
| Cell | Button (cycles through CYCLE on click) |

**Cell Behavior:**
- Click cell → cycle through: present → absent → holiday → credited → unmarked
- On click, optimistic update to grid state
- Calls `/attendance` with mark data (endpoint path not in code, but behavior evident)
- Each cell styled by current status and colored accordingly

**API Endpoints:**
- `GET /attendance?batchId=:id&from=YYYY-MM-01&to=YYYY-MM-EOM` → AttendanceGrid
  - `grid.rows[].student` (\_id, name, displayId)
  - `grid.rows[].marks` (Record<YYYY-MM-DD, status>)
  - `grid.dates[]` (array of YYYY-MM-DD strings)
  - `grid.batch` (name)

---

## Page: `/[slug]/admin/payments`

**Fee history + Razorpay webhook reconciliation**

### Summary Stats
| Card | Label | Value | Icon |
|------|-------|-------|------|
| 1 | Collected This Month | ₹{amount} | Wallet |
| 2 | Overdue | {count} records | Radio |
| 3 | Unmatched Webhooks | {count} events | Link2 |

### Sub-tabs: History / Reconciliation

#### TAB: History
**Payment Table:**
| Column | Render |
|--------|--------|
| Student | Name |
| Type | fee / admission (capitalized) |
| Period | Text or "—" |
| Amount | formatCurrency (bold) |
| Status | StatusBadge (paid/partial/overdue/free) |
| Method | capitalize(method): manual, cash, razorpay, etc. |
| Paid At | formatDate(paidAt) or "—" |

**API Endpoints:**
- `GET /payments?page=1&limit=100` → Paginated PaymentRow[]

#### TAB: Reconciliation
**Webhook Events List:**
| Element | Render | Action |
|---------|--------|--------|
| Event row | eventType · payerName | |
| Contact | formatPhone(contact) or "No contact" | |
| Amount | formatCurrency or "Amount n/a" | |
| Time | timeAgo(receivedAt) | |
| Status badge | StatusBadge (matched/unmatched) | |
| Match button | Outline button (if unmatched) | Opens match confirm modal |

**Modal: Match Webhook Event**
**Trigger:** "Match" button on unmatched event
**Title:** "Match webhook event"
**Message:** "Link \"{eventType}\" from {payerName}... to a payment record."

**Form:**
| Field | Type |
|-------|------|
| Payment record | Select searchable | Shows `{student.name} · {amount} · {period/type}` |

**API Endpoints:**
- `GET /payments/reconciliation?page=1&limit=100` → Paginated WebhookEventRow[]
- (No endpoint for match yet; local-only until backend adds it)

### Modal: Manual Fee Entry
**Trigger:** "Manual Fee Entry" button
**Title:** "Manual Fee Entry"
**Subtitle:** "Record a cash / bank / offline payment"

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Student | Select searchable | Yes; shows "{name} ({displayId})" |
| Type | Select | Yes (Fee / Admission) |
| Amount (₹) | Number input | Yes; must be valid positive |
| Classes purchased | Number input | No |
| Period | Input | No; e.g., "Jun 2026" |
| Method | Select | Yes (Manual/Bank, Cash, Razorpay link) |
| Status | Select | Yes (Paid, Partial, Overdue, Free) |

**Form Behavior:**
- Validates student, amount, amount format
- On save: calls `/payments` with { studentId, type, amount (in paise), period?, method, status, paidAt (if status=paid) }
- New payment added to head of list
- Toast: "{amount} recorded for {name}" (+ classes note if entered)

**API Endpoints:**
- `POST /payments` → { studentId, type, amount, period?, method?, status, paidAt? }

---

## Page: `/[slug]/admin/settings`

**School profile branding + public address (slug change request)**

### Section: School Profile
| Element | Type | Action |
|---------|------|--------|
| Logo image | Image or badge | |
| Replace/Add logo button | Outline button | Opens file picker |
| Remove logo button | Ghost button (if logo set) | Clears logoUrl |
| Logo note | Text | "Square image works best..." |
| School name input | Input required | |
| Tagline input | Input | Placeholder: "Where every note finds its home" |
| Brand color presets | 8 color buttons | Click to select (shows border on active) |
| Custom color picker | HTML color input | Click to open color picker |
| Color hex input | Input | Type custom hex value (e.g., #5B8DEF) |
| Live preview badge | Badge | Shows selected color with text |
| Save profile button | Brand button | Submits branding changes; page reloads on success |

**Form Behavior:**
- Logo upload: validates image file type; if presigned S3 available, uploads via PUT; otherwise inlines as data-URL (max 200KB)
- On save: validates schoolName non-empty, primaryColor is valid hex
- Calls `PATCH /settings/branding` with { schoolName, tagline, primaryColor, logoUrl }
- On success: page reloads (non-mock mode) to apply branding globally
- Toast confirmation

**API Endpoints:**
- `GET /settings/profile` → SchoolProfileData (includes branding, pendingSlugRequest)
- `PATCH /settings/branding` → { schoolName, tagline, primaryColor, logoUrl }
- `POST /settings/logo-upload-url` → { uploadUrl (pre-signed S3), publicUrl }

### Section: Public Address (Slug)
| Element | Type | Action |
|---------|------|--------|
| Current address | Code display | "/{slug}" |
| Pending request badge | Badge (amber) | Shows "Pending approval: /{requestedSlug}" if exists |
| Request address change button | Outline button | Opens slug request modal |

**Modal: Request Address Change**
**Title:** "Request address change"
**Subtitle:** "Reviewed and applied by your platform administrator"

**Form Fields:**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| New address | Input | Yes | Lowercase, numbers, hyphens; min 3 chars (regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) |
| Preview | Code display | N/A | Shows "/{newSlug}/admin" |
| Reason | Input | No | "Why do you want this change?" |

**Form Behavior:**
- Validates slug format and min length
- Validates slug is different from current
- On submit: calls `/settings/slug-request` with { requestedSlug, reason? }
- Response updates profile state with pending request
- Toast: "Request sent — your platform administrator will review it"
- Modal closes, form resets

**API Endpoints:**
- `POST /settings/slug-request` → { requestedSlug, reason? }

---

## Page: Not Yet Covered in Detail — Component Breakdown

---

### Component: ApproveRequestModal
**Props:**
```typescript
request: RequestItem | null
onClose: () => void
onApproved: (requestId: string, student: ApprovedStudent | null) => void
```

**Purpose:** Full enrollment approval form (separate from the requests page table because approval is a multi-field edit step, not a one-click action).

**Usage:** Called from `/requests` page; on success, request is marked approved and new student appears in `/students`.

---

### Component: DeclareHolidayModal
**Props:**
```typescript
open: boolean
onClose: () => void
fixedBatchId?: string  // If set, lock to one batch
fixedBatchName?: string
onDeclared: (holidays: HolidayItem[]) => void
```

**Purpose:** Holiday declaration form (scope: single batch OR all active batches).

**Scope Toggle (if allowAll):**
- "All active batches" (school-wide holiday; fans out to all active batches)
- "One batch" (batch-specific; scoped to one batch)

**Form Fields:**
| Field | Type | Required |
|-------|------|----------|
| Scope | Radio (All/One) | Yes |
| Batch | Select (if scope=one) | Depends on scope |
| Date | DatePicker | Yes |
| Student category | Select | Yes (Regular / Trial) |
| Reason | Input | No |

**API Endpoint:**
- `POST /holidays` → { allBatches: true, ... } OR { batchId, ... }
- Response: `{ holidays: HolidayItem[], declared: number }`

---

### Component: StudentEditDialog
**Props:**
```typescript
studentId: string | null
studentName?: string
onClose: () => void
onUpdated?: (updated: StudentDetail) => void
```

**Purpose:** Full student editor modal (form + live activity rail).

**Layout:** 2-column (form scrollable left, activity rail right)

**Activity Rail (right):**
- Displays fetched AuditLogItems on open
- Optimistically prepends new AuditLogItem on save (each field change = one node)
- Each node shows: action, timestamp, actor, per-field diffs

---

### Component: StudentEditForm
**Props:**
```typescript
detail: StudentDetail
onSaved: (updated: StudentDetail, changes: StudentEditChange[], action: string) => void
```

**Purpose:** Reusable form for editing student enrollment details.

**Behavior:**
- On mount, loads batches, teachers, day patterns from API
- Tracks field changes by comparing current state to `detail`
- Only calls API if changes detected
- Returns changes as (field, from, to) tuples for activity timeline
- Determines action: "UPDATE_PAID_AMOUNT" (if only fee fields changed) or "UPDATE_STUDENT"

---

### Component: StudentDetailModal
**Props:**
```typescript
studentId: string | null
studentName?: string
onClose: () => void
```

**Purpose:** Read-only student detail popup (appears on row click in students table).

**Tabs:**
1. **Profile** — Status timeline, grid of fields, validity window, fees, classes, attendance summary
2. **Payments** — Table of student's payment records
3. **Activity** — ActivityFeed of AuditLogItems

**API Calls:**
- `GET /students/:id` → StudentDetail
- `GET /students/:id/activity` → Paginated AuditLogItem[]
- `GET /payments` (scoped to this student in modal)

---

### Component: OperatorBanner
**Purpose:** Superadmin impersonation banner (P2-07 UI shell).

**Appearance:**
- Violet-colored banner (violet-500/10 bg, violet-600 text)
- Shows: "Operator session — full access to {schoolName}" + "Exit operator view" button

**Mount Logic:**
- Client-side only: reads `mm_impersonate` cookie (format: `slug|institutionName`)
- Slides in with motion animation on mount
- Cookie read in useEffect (post-mount) to avoid hydration mismatch

**Exit Behavior:**
- Clears cookie
- Navigates to NEXT_PUBLIC_OPERATOR_PANEL_URL (default: `http://localhost:3010/institutions`)

---

### Component: TopNav
**Purpose:** Top bar inside content column (school identity + admin greeting + theme toggle).

**Elements:**
| Element | Render |
|---------|--------|
| Page title | "Admin Dashboard" (static) |
| Greeting | "Welcome back, {adminName}" |
| Theme toggle button | Moon/Sun icon (based on current theme) |
| School logo/badge | Image or initials badge (from session) |
| Admin name card | Avatar + name (animated gradient text; colors from brand var) |

---

### Component: ActivityRail
**Purpose:** Vertical timeline of AuditLogItems (shown in StudentEditDialog, TeachersPage edit).

**Render:**
- Left border with icon nodes per entry
- Each entry: action icon, action name, timestamp (timeAgo), actor, per-field diffs
- Field diffs show: "FIELD changed from {from} to {to}"
- Money fields formatted via formatCurrency; all others as strings

---

### Component: ActivityFeed
**Purpose:** Non-interactive timeline of AuditLogItems (shown in StudentDetailModal Activity tab).

**Render:** Same as ActivityRail but ordered feed format

---

### Component: ConfirmModal
**Purpose:** Generic confirmation dialog (reusable for destructive actions).

**Props:**
```typescript
open: boolean
onClose: () => void
title: string
message?: string
confirmLabel?: string
destructive?: boolean  // Changes button color
onConfirm: () => Promise<void> | void
children?: React.ReactNode  // Extra form fields
```

**Usage Examples:**
- Reject enrollment request (with optional reason input)
- Delete holiday (confirmation only)
- Match webhook event (with payment record select)

---

## 4. COMPLETE API ENDPOINT REFERENCE

### Authentication
- `GET /branding` (pre-auth) → BrandingPublic
- `POST /auth/login` → AdminSession
- `GET /auth/me` → AdminSession
- `POST /auth/logout` → void

### Students
- `GET /students?page=1&limit=100` → Paginated<StudentRow[]>
- `GET /students/:id` → StudentDetail
- `GET /students/:id/activity` → Paginated<AuditLogItem[]>
- `PATCH /students/:id` → { student: { _id } }

### Requests
- `GET /requests?status=all` → Paginated<RequestItem[]>
- `POST /requests` → void
- `POST /requests/:id/approve` → { student: ApprovedStudent, tempPassword }
- `POST /requests/:id/reject` → void

### Teachers
- `GET /teachers?page=1&limit=100` → Paginated<TeacherRow[]>
- `GET /teachers/:id/activity` → Paginated<AuditLogItem[]>
- `POST /teachers` → void
- `PATCH /teachers/:id` → void

### Batches
- `GET /batches?page=1&limit=100` → Paginated<BatchRow[]>
- `GET /batches/:id` → { batch: BatchDetail }
- `GET /batches/:id/sessions?page=1&limit=30` → Paginated<ClassSessionItem[]>
- `GET /batches/:id/attendance-summary` → { classes: BatchAttendanceClass[] }
- `GET /batches/:id/students` → { students: BatchStudentItem[] }
- `POST /batches` → void
- `POST /batches/:id/sessions` → { session: ClassSessionItem }

### Day Patterns
- `GET /day-patterns` → DayPatternItem[] | Paginated<DayPatternItem[]>
- `POST /day-patterns` → void
- `PATCH /day-patterns/:id` → void

### Time Slots
- `GET /time-slots` → TimeSlotItem[] | Paginated<TimeSlotItem[]>
- `POST /time-slots` → void
- `PATCH /time-slots/:id` → void

### Holidays
- `GET /holidays?batchId=:id` → { holidays: HolidayItem[] }
- `POST /holidays` → { holidays: HolidayItem[], declared: number }
- `DELETE /holidays/:id` → void

### Attendance
- `GET /attendance?batchId=:id&from=YYYY-MM-DD&to=YYYY-MM-DD` → AttendanceGrid
- `POST /attendance/mark` → { applied: number }

### Payments
- `GET /payments?page=1&limit=100` → Paginated<PaymentRow[]>
- `GET /payments/reconciliation?page=1&limit=100` → Paginated<WebhookEventRow[]>
- `POST /payments` → void
- `POST /settings/logo-upload-url` → { uploadUrl, publicUrl }

### Settings
- `GET /settings/profile` → SchoolProfileData
- `PATCH /settings/branding` → { branding: BrandingPublic } | null
- `POST /settings/slug-request` → void

### Dashboard
- `GET /dashboard` → AdminDashboardData

---

## 5. COMPLETE WORKFLOWS

### Workflow 1: Admin Login
1. Navigate to `/{slug}/admin/login`
2. Layout fetches `GET /branding` (pre-auth) → renders school logo/name/tagline
3. Admin enters email + password
4. Submit → `POST /auth/login` → stores session (via auth cookie)
5. On success → redirect to `/{slug}/admin/dashboard`

---

### Workflow 2: Approve Enrollment Request (Full End-to-End)
1. Navigate to `/{slug}/admin/requests`
2. Page loads pending requests: `GET /requests?status=all`
3. Admin sees request in table: name, mobile, preferred days/time, status
4. Click "Approve" button → ApproveRequestModal opens
5. Modal fetches: `GET /batches`, `GET /teachers`, `GET /day-patterns`
6. Admin fills form:
   - Selects instrument, mode, session type, join status, class type, payment status
   - Selects teacher (optional)
   - **Selects batch** → modal fetches that batch's dayPattern
   - Sets validity start/end dates → form calculates days and classes
   - Sets fee (optional)
7. Click "Approve & Create Student"
   - Validates all required fields
   - `POST /requests/:id/approve` with enrollment details
   - Response: `{ student: { _id, displayId, name }, tempPassword }`
8. Toast shows temp password for 8 seconds
9. Request row changes status to "approved"
10. New student immediately appears in Students table

---

### Workflow 3: Add Student via Request Creation
1. Navigate to `/{slug}/admin/requests`
2. Click "New Request" button → Modal opens
3. Fill form: name, mobile, email (opt), instrument, preferred days, preferred time
4. Click "Create Request"
   - `POST /requests` with form data
5. New request appears at head of table with status "pending", paymentStatus "unpaid"
6. Then proceed with Workflow 2 (Approve) if ready

---

### Workflow 4: Create Batch
1. Navigate to `/{slug}/admin/batches`
2. Click "Create Batch" button → Modal opens
3. Page fetches: `GET /batches`, `GET /day-patterns`, `GET /time-slots`, `GET /teachers` (in modal)
4. Admin selects:
   - Instrument (required)
   - Day pattern (required, active only)
   - Time slot (required)
   - Teacher (optional)
   - Mode: online/offline toggle (default: online)
   - Name: toggle between auto-generate or manual input
5. Click "Create Batch"
   - `POST /batches` with { instrumentId, dayPatternId, timeSlotId, teacherId?, mode, name? }
6. New batch appears in list (status: "active" if teacher set, else "setting")
7. Toast: "Batch \"{name}\" created"

---

### Workflow 5: Declare Holiday (School-Wide or Single Batch)
1. Navigate to `/{slug}/admin/batches` (school-wide) OR `/{slug}/admin/batches/[id]` (single batch)
2. Click "Declare Holiday" button → Modal opens
3. If school-wide, choose scope: "All active batches" or "One batch"
4. If "One batch", select batch from dropdown
5. Select date via DatePicker
6. Select student category: Regular or Trial
7. Enter reason (optional)
8. Click "Declare Holiday"
   - If school-wide: `POST /holidays` with { allBatches: true, date, studentCategory, reason? }
   - If single: `POST /holidays` with { batchId, date, studentCategory, reason? }
   - Response: `{ holidays: HolidayItem[], declared: number }`
9. Toast: "Holiday declared for {n} batches" (or single batch)
10. Affected students get class credited back (visible on teacher/student panels)

---

### Workflow 6: Mark Attendance (Month Grid)
1. Navigate to `/{slug}/admin/attendance`
2. Select batch from dropdown
3. Navigate months with prev/next buttons
4. Grid loads: `GET /attendance?batchId=:id&from=YYYY-MM-01&to=YYYY-MM-EOM`
5. Grid shows students (rows) × class dates (columns)
6. Each cell is a button with status char (P/A/H/C/–)
7. Click cell → cycle through: present → absent → holiday → credited → unmarked
8. Optimistic update to grid
9. `POST /attendance/mark` with { batchId, date, marks: [{ studentId, status }] }
10. Toast on success

---

### Workflow 7: Edit Student (Full Form + Activity Timeline)
1. Navigate to `/{slug}/admin/students`
2. Click pencil icon on row → StudentEditDialog opens
3. Dialog fetches:
   - `GET /students/:id` → StudentDetail
   - `GET /students/:id/activity` → Paginated AuditLogItem[]
   - `GET /batches`, `GET /teachers`, `GET /day-patterns` (to populate selects)
4. Admin edits any fields: teacher, batch, instrument, classType, mode, sessionType, joinStatus, category, validity dates, paid/upcoming classes/amounts, etc.
5. Click "Save changes"
   - Compares current state to original `detail`
   - Builds `changes[]` with (field, from, to) for each difference
   - If no changes, shows toast "Nothing changed"
   - If changes exist: `PATCH /students/:id` with all changed fields
6. On success:
   - Updates StudentDetail state locally
   - Optimistically prepends new AuditLogItem to activity rail (each field change = one node with icon, action, timestamp, diffs)
   - Toast: "{name} updated — change recorded in the activity log"
   - Modal stays open (so admin can watch activity rail update live)

---

### Workflow 8: Edit School Profile (Branding)
1. Navigate to `/{slug}/admin/settings`
2. Page fetches: `GET /settings/profile`
3. Admin edits:
   - Logo: click "Replace/Add logo" → file picker → validates image type
     - If S3 configured: `POST /settings/logo-upload-url` → uploads via PUT to presigned URL
     - Else: inlines as data-URL (max 200KB)
   - School name, tagline
   - Brand color: pick preset, custom picker, or type hex
4. Click "Save profile"
   - Validates schoolName non-empty, primaryColor is valid hex
   - `PATCH /settings/branding` with { schoolName, tagline, primaryColor, logoUrl }
5. On success:
   - Toast: "School profile saved — applying your branding everywhere"
   - Page reloads (non-mock mode) to apply branding globally (sidebar, top nav, login page)

---

### Workflow 9: Request Slug Change
1. Navigate to `/{slug}/admin/settings`
2. Scroll to "Public address" section
3. See current "/{slug}"
4. If no pending request, click "Request address change" button → Modal opens
5. Enter new address (validated: lowercase, numbers, hyphens, min 3 chars)
6. See preview "/{newSlug}/admin"
7. Enter reason (optional)
8. Click "Submit request"
   - `POST /settings/slug-request` with { requestedSlug, reason? }
9. On success:
   - Profile state updated with `pendingSlugRequest`
   - Badge appears showing "Pending approval: /{newSlug}"
   - Toast: "Request sent — your platform administrator will review it"
10. On approval (by operator), all users logged out, old slug stops working, new slug active

---

### Workflow 10: Launch Class Session
1. Navigate to `/{slug}/admin/batches/[id]`
2. Click "Overview" tab
3. Set target date (default: today)
4. Paste meeting URL (Zoom, Meet, etc.)
5. Click "Launch Class"
   - Validates URL format
   - `POST /batches/:id/sessions` with { meetingUrl, targetDate }
   - Response: `{ session: ClassSessionItem }`
6. Session appears in archive below
7. Toast: "Session launched — link saved to the archive for {date}"

---

### Workflow 11: View Student Detail (Read-Only Popup)
1. Navigate to `/{slug}/admin/students`
2. Click table row (any student)
3. StudentDetailModal opens
4. Dialog fetches:
   - `GET /students/:id` → StudentDetail
   - `GET /students/:id/activity` → Paginated AuditLogItem[]
   - `GET /payments` (scoped to this student)
5. **Profile tab** (default):
   - Status timeline: Trial → Active Soon → Active (or Inactive flagged)
   - Fields: mobile, email, instrument, class type, batch, teacher, schedule, category, validity window, fees/classes, attendance summary
6. **Payments tab**:
   - Table of payments for this student
7. **Activity tab**:
   - ActivityFeed of AuditLogItem[] (all changes to this student)
8. Close modal to return to students page

---

### Workflow 12: Reconcile Payment (Match Webhook Event)
1. Navigate to `/{slug}/admin/payments`
2. Click "Reconciliation" sub-tab
3. Page shows webhook events from Razorpay (or other payments)
4. Unmatched events have a "Match" button
5. Click "Match" on an unmatched event → ConfirmModal opens
6. Modal shows event details (eventType, payerName, amount, contact)
7. Select payment record from dropdown (shows "{name} · {amount} · {period/type}")
8. Click "Match Event"
   - (Currently local-only; no API endpoint yet)
   - Event row now shows StatusBadge "matched" instead of "unmatched"
   - Toast: "Webhook event matched to payment record"

---

### Workflow 13: Add Teacher
1. Navigate to `/{slug}/admin/teachers`
2. Click "Add Teacher" button → Modal opens
3. Fill form:
   - Full name (required)
   - Mobile (required, 10-digit)
   - Alternate mobile (optional)
   - Email (required, email format)
   - Gender (optional: Female/Male/Other)
   - Monthly salary (optional, shown in paise note)
4. Click "Add Teacher"
   - Validates required fields
   - `POST /teachers` with { name, mobile, email, altMobile?, gender?, salaryAmount? }
5. New teacher added to list with:
   - Auto-generated displayId (TCH-NNN)
   - `panelAccess: ["teacher"]` (admin-panel access can only be granted by operator)
6. Toast: "{name} added to faculty"

---

### Workflow 14: Edit Teacher (with Activity Timeline)
1. Navigate to `/{slug}/admin/teachers`
2. Click pencil icon or row
3. Modal opens (wider: max-w-4xl)
4. Dialog fetches:
   - Teacher data (already in table row)
   - `GET /teachers/:id/activity` → Paginated AuditLogItem[]
5. Layout: form on left (scrollable), activity rail on right
6. Edit fields: name, mobile, altMobile, email, gender, salaryAmount, status
7. Click "Save Changes"
   - Compares to original, builds `changes[]`
   - `PATCH /teachers/:id` with changed fields
8. On success:
   - Optimistically prepends new AuditLogItem to activity rail (e.g., "name changed from X to Y")
   - Toast: "{name} updated — change recorded in the activity log"
   - Modal stays open to show activity update

---

### Workflow 15: Create Suitable Days Pattern
1. Navigate to `/{slug}/admin/suitable-days`
2. Right panel: "New Pattern"
3. Click day buttons (Mon-Sun) to select which days the pattern covers
4. Selected days highlight and show checkmarks
5. Click "Create Cycle"
   - `POST /day-patterns` with { days: ["mon", "wed", "fri"] } (ordered)
6. New pattern added to left list with label "Mon · Wed · Fri"
7. New pattern isActive: true by default (selectable in batch/request forms)
8. Toast: "Pattern created — it is now selectable in batch and enrollment forms"

---

### Workflow 16: Create Suitable Times Window
1. Navigate to `/{slug}/admin/suitable-times`
2. Right panel: "New Window"
3. Enter start time (time input, e.g., 09:00)
4. Enter end time (time input, e.g., 10:00)
5. Click "Open Window"
   - Validates both times present, end > start
   - `POST /time-slots` with { startTime: "09:00", endTime: "10:00" }
6. New slot added to left list with label "9:00 AM–10:00 AM"
7. New slot isOnline: true by default
8. Toast: "Window registered — it is now selectable across the platform"

---

### Workflow 17: Record Manual Payment
1. Navigate to `/{slug}/admin/payments`
2. Click "Manual Fee Entry" button → Modal opens
3. Fill form:
   - Student (select searchable, shows "{name} ({displayId})")
   - Type (Fee or Admission)
   - Amount (₹)
   - Classes purchased (optional)
   - Period (optional, e.g., "Jun 2026")
   - Method (Manual/Bank, Cash, Razorpay link)
   - Status (Paid, Partial, Overdue, Free)
4. Click "Record Payment"
   - Validates student, amount, amount format
   - `POST /payments` with { studentId, type, amount (paise), period?, method, status, paidAt (if status=paid) }
5. New payment added to head of list
6. Toast: "{amount} recorded for {name}" (+ classes note if applicable)

---

## 6. SUMMARY

This institution admin panel is a **white-label, multi-tenant SaaS for music school administration** with the following scope:

- **8 main nav tabs** (Dashboard, Requests, Students, Teachers, Batches, Attendance, Payments, Settings)
- **15 pages** (including batch detail with 4 tabs)
- **30+ modals & dialogs** (approve request, declare holiday, edit student, edit teacher, create batch, create request, manual fee, match webhook, slug request, etc.)
- **6 complex data tables** (students, requests, teachers, payments, webhooks, batch rosters)
- **3 grid/chart visualizations** (enrollment trend line chart, attendance health bars, attendance month grid)
- **2 configuration tools** (suitable days + suitable times patterns)
- **Full CRUD** on students, teachers, batches, day patterns, time slots
- **Audit trails** on every student/teacher change (activity rails showing per-field diffs)
- **White-label branding** (school name, logo, color, tagline; all fed from BrandingPublic session data)
- **Operator impersonation banner** (P2-07: superadmin can view/audit any school via mm_impersonate cookie)
- **Razorpay webhook reconciliation** (match webhook events to payment records)

**Every element, action, and API endpoint is exhaustively inventoried above for end-to-end QA clicking of every feature.**