# Institution Student Panel — Feature Inventory (port 3003)

## Routes (`/[slug]/student/...`)
| URL | Purpose |
|---|---|
| `/login` | mobile + password (white-label hero: logo/name/tagline) |
| `/` | redirect → dashboard |
| `/dashboard` | greeting, holiday notice, next-class card, 4 stats, class balance ring, attendance dots |
| `/classes` | attendance history grouped by month with P/A/H summary chips |
| `/timetable` | weekly grid (Mon–Sun), week prev/next nav, holiday strikethrough |
| `/payments` | validity card + fee receipts table (endpoint PENDING CONTRACT — mock-only) |
| `/profile` | identity card (5 facts) + contact form (email, guardian name/mobile) |

## Navigation
Desktop sidebar ("My School": Dashboard · My Classes · Timetable · Payments · Profile)
+ student avatar/ID footer + Sign out. Mobile: top bar + hamburger slide-over drawer
(same items, theme toggle, sign out).

## Key clickables per page
- **/login** — mobile (tel), password, Sign in → `POST /api/inst/:slug/auth/student/login`; "Forgot password → ask your school" helper text.
- **/dashboard** — data from `GET /student/dashboard` + `GET /student/classes?limit=10`; stat cards: Attendance %, Classes Remaining, Validity Days Left, Weekly Schedule; class-balance progress ring; recent-attendance dots strip.
- **/classes** — `GET /student/classes?limit=50`; month sections with present/absent/holiday chips; rows: date badge, batch name, time, ClassStatusBadge (present green / absent red / holiday amber / upcoming blue).
- **/timetable** — `GET /student/timetable`; 7-day grid, today highlighted; class slot / holiday (strikethrough + "Holiday · credited") / "No class"; ‹ Prev · This week · Next › buttons; upcoming-holidays note.
- **/payments** — validity card ("Classes paid until", renewal reminder, classes-left CountUp, total paid); DataTable: Date/Type/Amount/Classes/Method/Status. **NOTE: payments + balance are mock-only — real endpoint not in CONTRACTS yet → expect empty in live mode.**
- **/profile** — identity card (Instrument, Batch, Schedule, Guardian, Valid Until facts); contact form: mobile DISABLED (sign-in ID), email/guardianName/guardianMobile editable → `PATCH /student/me`.

## Core workflows
1. Login by mobile → branded dashboard (institution brand ONLY — white-label check).
2. Browse attendance history by month.
3. Navigate timetable weeks; verify holiday crediting display.
4. View payments/validity (empty-state acceptable in live mode — pending contract).
5. Edit profile contact fields, save, verify toast + persistence.
6. Sign out → back to branded login.
