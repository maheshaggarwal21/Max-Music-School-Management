# MaxMusic Platform — Master Feature Inventory & E2E QA Plan

> Generated 2026-06-11 by code exploration of all 4 panels. Per-panel detail:
> [operator-panel.md](operator-panel.md) · [admin-panel.md](admin-panel.md) ·
> [teacher-panel.md](teacher-panel.md) · [student-panel.md](student-panel.md)

## Panels & local URLs
| Panel | URL | Login |
|---|---|---|
| Operator | http://localhost:3000/login | `admin@maxmusic.internal` / `Operator@123` (or mobile OTP; TOTP removed) |
| Admin | http://localhost:3001/demo-music-academy/admin/login | `teacher@demo.internal` / `Teacher@123` |
| Teacher | http://localhost:3002/demo-music-academy/teacher/login | mobile `9999999999` / `Teacher@123` |
| Student | http://localhost:3003/demo-music-academy/student/login | mobile `8888888888` / `Student@123` |

## Tab map (all panels)
- **Operator (9 tabs):** Dashboard · Institutions (+detail: Overview/Actions/Rent) · Slug Requests · Students · Teachers · Payments (Fees/Rent) · Changes History · Settings
- **Admin (10 tabs):** Dashboard · New Requests · Students · Teachers · Batches (+detail: Overview/Holiday/Attendance/Students) · Attendance · Payments (History/Reconciliation) · Suitable Days · Suitable Times · Settings
- **Teacher (5 tabs):** Dashboard · My Batches (+detail, holidays folded in) · Attendance · Teachers · Profile
- **Student (8 tabs):** Dashboard · My Classes · Timetable · Payments · Profile · Metronome · Guitar Chords · Contact Us

## Cross-panel E2E workflows (the QA spine)
1. **Operator login (password or OTP)** → dashboard.
2. **Create institution** (operator) — managed AND autonomous variants.
3. **Grant Admin Access** (scenario 3: managed → autonomous, owner gains admin panel; revoke = reverse).
4. **Configure school** (admin): suitable-days pattern → suitable-time window → **create batch** (auto-named; with/without teacher = active/setting).
5. **Add teacher** (admin) → teacher can log in to teacher panel.
6. **Enrollment two-step**: New Request (admin) → **Approve** w/ full enrollment form → Student created + temp password → student appears in Students tab.
7. **Mark attendance** (teacher one-tap flow + admin month grid + admin correction toggle) with Socket.io live refresh.
8. **Declare holiday** (admin: single batch + all batches; teacher: request + withdraw) → class credited back.
9. **Manual fee entry** (admin) → visible in admin history + student validity; operator Payments shows cross-institution fees.
10. **Launch class session** (admin batch Overview) → archive.
11. **Branding edit** (admin settings: name/tagline/color) → reflected across panels (white-label).
12. **Slug change request** (admin) → operator queue → approve/reject.
13. **Impersonation** (operator Panel button → admin panel via god-token, operator banner).
14. **Suspend/Reactivate institution** → all-institution logout (tokenVersion).
15. **God-mode edits** (operator students/teachers) → activity rail + audit Changes History.
16. **Student panel read flows**: dashboard, classes, timetable, payments (pending-contract empty state), profile edit.
17. **White-label invariant on every institution page:** zero "Max Music" strings rendered.

## Known open bugs going in (from AUDIT.md §6)
- **P2 BUG-01** DayPattern multikey unique index (`models/DayPattern.js:38`) — second pattern sharing any day E11000s.
- **P2 BUG-02** Input `useId` hydration mismatch (`packages/ui/src/components/form/input.tsx:15`) — htmlFor mismatch on every form.
- P3: ClassSession index · `ref is not a prop` warning · `@maxmusic` scope in bundle paths · INFO god-token tokenVersion window.
