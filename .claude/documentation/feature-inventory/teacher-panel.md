# Institution Teacher Panel — Feature Inventory (port 3002, mobile-first)

## Routes (`/[slug]/teacher/...`)
| URL | Purpose |
|---|---|
| `/login` | mobile + password (white-label branding pre-fetched) |
| `/dashboard` | greeting, today's class timeline, next-class card, 3 stats |
| `/batches` | grid of assigned batch cards |
| `/batches/[id]` | batch header + read-only student roster table |
| `/attendance` (`?batch=` optional) | batch chips → date picker → one-tap marking → save |
| `/holidays` | school holidays (read-only) + my requests (create/withdraw) |
| `/profile` | identity card + contact info edit (email, mobile) |

## Navigation
Desktop sidebar + mobile bottom 5-tab bar: Dashboard · My Batches · Attendance ·
Holidays · Profile. Mobile sticky header: logo/name + theme toggle. Sign Out →
`POST /api/inst/:slug/auth/teacher/logout`.

## Key clickables per page
- **/login** — mobile (tel, 10-digit validation), password (+show/hide toggle), Sign in → `POST /api/inst/:slug/auth/teacher/login`.
- **/dashboard** — stats (My Batches / Students Taught / Classes This Week), Next-class card **Mark attendance** → `/attendance?batch=…`, today's timeline.
- **/batches** — SpotlightCard per batch (name, instrument, day pattern, time slot, student count, status) → click → detail.
- **/batches/[id]** — back link, header card, **Mark attendance** button, roster DataTable (Student/Mobile/Status/Valid till; sortable).
- **/attendance** — batch chip row (active/setting only), DatePicker, summary bar (present/absent/holiday/credited/unmarked), **Submit All Present**, per-student 4 toggle buttons (Present ✓ emerald / Absent ✗ red / Holiday amber / Credited brand) with optimistic update + undo toast, sticky **Save attendance** bar (validates ≥1 present/absent) → `POST /attendance/mark` (only present/absent sent). **Live sync**: `GET /realtime-token` → Socket.io → `attendance:marked` event → refetch marks if batch+date match.
- **/holidays** — **Request holiday** modal (batch select, date, student category regular/trial, optional reason) → `POST /holidays`; My-requests rows with Trash withdraw (optimistic + undo) → `DELETE /holidays/:id`; school holidays read-only.
- **/profile** — identity card (avatar, displayId, status, instruments derived from batches, panelAccess badges read-only), contact form (email + mobile validated) → `PATCH /me`.

## Core workflows
1. Login by mobile → dashboard.
2. Mark attendance end-to-end (select batch → date → tap marks → save → Socket.io broadcast refreshes other viewers).
3. Submit-all-present shortcut.
4. Request + withdraw a holiday (credits class back to category).
5. Edit contact info.
6. Sign out.
