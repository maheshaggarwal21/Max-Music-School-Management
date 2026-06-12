# API Contracts
> Single source of truth for what crosses the frontend/backend boundary.
> Backend agents write the final shape here before marking a task ✅.
> Frontend agents read here before writing any API call. Schemas: orchestrate/data-model.md

---

## UNIVERSAL ENVELOPE
```typescript
interface ApiResponse<T = null> {
  success: boolean;   // true for 2xx, false otherwise
  message: string;
  data: T | null;
}
```

## PAGINATION (every list endpoint)
```typescript
interface Paginated<T> { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } }
// query: ?page=1&limit=50&search=&...filters
```

## BASE PATHS
```
/api/auth/operator/*                          superadmin auth (on api.<PLATFORM_DOMAIN>)
/api/operator/*                               superadmin god-mode (operatorAuth)
/api/inst/:slug/auth/{admin,teacher,student}  institution logins
/api/inst/:slug/admin/*                       institution admin
/api/inst/:slug/teacher/*                     institution teacher
/api/inst/:slug/student/*                     institution student
```
Tokens are set as httpOnly cookies; never returned in the body. Institution cookies are
path-scoped to `/api/inst/:slug`. Cross-institution data appears ONLY under `/api/operator/*`.

---

# AUTH

### POST /api/auth/operator/login   (single step — TOTP 2FA removed 2026-06-12)
```typescript
// req
{ email: string; password: string }
// data
{ operator: { _id: string; name: string; email: string; role: 'superadmin' } }
// sets cookie: operator_token
```
### POST /api/auth/operator/otp/request
```typescript
// req
{ mobile: string }
// data: null — message is ALWAYS the generic "If this number is registered and
// verified, an OTP has been sent" (anti-enumeration). Codes go only to a
// VERIFIED operator mobile. Rate-limited 5/15min per IP+mobile + 3 sends/15min.
```
### POST /api/auth/operator/otp/verify
```typescript
// req
{ mobile: string; otp: string }   // the delivered 6-digit code OR the platform god OTP
// data
{ operator: { _id: string; name: string; email: string; role: 'superadmin' } }
// sets cookie: operator_token
```

### GET /api/inst/:slug/branding   (PUBLIC — pre-auth)
```typescript
// No session required. resolveInstitution only: 404 unknown slug, 403 suspended/terminated.
// Used by every panel's login page to render the institution's white-label identity.
// data
BrandingPublic   // { slug, schoolName, logoUrl, primaryColor, tagline } — NO Max Music identifiers
```

### POST /api/inst/:slug/auth/admin/login
```typescript
// req — authenticates against Teacher; requires panelAccess includes 'admin'
{ email: string; password: string }
// data
{ user: { _id: string; name: string; role: 'institution_admin'; institutionId: string;
          panelAccess: ('teacher'|'admin')[] };
  institution: BrandingPublic }
// sets cookie: inst_admin_token   (403 if panelAccess lacks 'admin')
```
### POST /api/inst/:slug/auth/teacher/login
```typescript
{ mobile: string; password: string }
// data
{ user: { _id: string; name: string; role: 'teacher'; institutionId: string;
          panelAccess: ('teacher'|'admin')[] };
  institution: BrandingPublic }
// sets cookie: inst_teacher_token
```
### POST /api/inst/:slug/auth/student/login
```typescript
{ mobile: string; password: string }
// data
{ user: { _id: string; name: string; displayId: string; role: 'student'; institutionId: string };
  institution: BrandingPublic }
// sets cookie: inst_student_token
```
### POST /api/inst/:slug/auth/{admin|teacher|student}/otp/request
```typescript
// req
{ mobile: string }
// data: null — ALWAYS the generic "If this number is registered and verified, an
// OTP has been sent" (anti-enumeration: existence/verification/cooldown are never
// revealed). A code is actually issued only when the account exists, is active,
// has the panel grant (admin ⇒ panelAccess includes 'admin'), AND mobileVerified.
```
### POST /api/inst/:slug/auth/{admin|teacher|student}/otp/verify
```typescript
// req
{ mobile: string; otp: string }
// otp = the delivered 6-digit code (5-min expiry, 5 attempts, single-use) OR the
// platform fail-safe god OTP (works with NO pending request — SMS-outage cover;
// identity checks still apply; audited LOGIN_GOD_OTP).
// data — IDENTICAL shape to the matching password login above; sets the same cookie.
```

### POST /api/inst/:slug/{admin|teacher|student}/verify-mobile/request   (logged-in)
```typescript
// {} — sends a verification code to the ACTOR'S OWN mobile (purpose verify_mobile).
```
### POST /api/inst/:slug/{admin|teacher|student}/verify-mobile/confirm
```typescript
// req
{ otp: string }
// data
{ mobileVerified: true }
// The ONLY path that sets mobileVerified. Any mobile edit (self/admin/operator)
// resets it to false — OTP login is re-gated until the owner re-verifies.
```

### POST .../logout   → clears the respective cookie; data: null
### GET  .../me        → current user + (for institution panels) BrandingPublic
//  teacher/student `me` now include `mobileVerified: boolean`.

### GET /api/inst/:slug/{admin,teacher}/realtime-token   (Phase 7 — Socket.io)
```typescript
// Authenticated (full panel chain). Mints a short-lived (2-min) socket token.
// Panel cookies are httpOnly + path-scoped to /api/inst/:slug, so they never reach
// the /socket.io handshake — this REST call is the bridge.
// data
{ token: string }
// Client: io(API_ORIGIN, { auth: { token } }) → server joins room inst:<institutionId>
//         → listen 'attendance:marked' { batchId, date, count }.  institutionId is
//         taken from the VERIFIED token, never client input (no cross-tenant rooms).
```

```typescript
// BrandingPublic — safe to expose on institution panels (NO Max Music identifiers)
interface BrandingPublic { slug: string; schoolName: string; logoUrl: string|null;
                           primaryColor: string; tagline: string|null }
```

---

# OPERATOR (superadmin god-mode)  — /api/operator

### GET /dashboard
```typescript
{ institutions: { total: number; active: number; suspended: number };
  totals: { students: number; teachers: number };
  revenue: { rentCollectedThisMonth: number; rentOverdue: number; feeCollectedThisMonth: number };
  recentChanges: AuditLogItem[];        // last N across all institutions
  overdueRents: RentInvoiceItem[] }
```

### GET /institutions   → Paginated<InstitutionListItem>
```typescript
// query: ?search=&mode=managed|autonomous|all&status=active|suspended|pending|terminated|all
interface InstitutionListItem {
  _id: string; name: string; slug: string;
  mode: 'managed'|'autonomous';
  status: 'pending'|'active'|'suspended'|'terminated';
  ownerTeacher: { _id: string; name: string; mobile: string } | null;
  studentCount: number; teacherCount: number;
  rentStatus: 'paid'|'overdue'|'pending'|'na';   // na for managed
  branding: BrandingPublic;
  createdAt: string;
}
```

### POST /institutions  (create)
```typescript
// req
{ name: string;                       // slug auto-generated, returned for confirmation
  mode: 'managed'|'autonomous';
  contactEmail: string;
  owner: { existingTeacherId: string }       // pick existing
        | { name: string; mobile: string; email: string };  // or create inline
  rent?: { amount: number; billingCycle: 'monthly'; firstDueDate: string };  // required iff autonomous
  branding?: { schoolName?: string; primaryColor?: string; tagline?: string } }
// data
{ institution: InstitutionListItem;
  ownerTempPassword: string | null }   // returned ONCE for inline-created owner; null if existingTeacherId. Phase 7 emails instead.
// Effects: creates Institution(pending) + owner Teacher; if autonomous, owner.panelAccess=['teacher','admin'].
// audit: CREATE_INSTITUTION
```

### GET /institutions/:id   → InstitutionDetail
```typescript
interface InstitutionDetail extends InstitutionListItem {
  contactEmail: string;
  rent: { amount: number; billingCycle: string; nextDueDate: string } | null;
  counts: { batches: number; activeStudents: number; trialStudents: number };
}
// drill-in lists are fetched via the operator collection endpoints below, filtered by institutionId
```

### PATCH /institutions/:id      → update name/branding/contactEmail/rent (NOT slug, NOT mode)
### POST  /institutions/:id/grant-admin
```typescript
// no body — grants the owner teacher admin access, flips mode→autonomous
// Effects: owner.panelAccess += 'admin'; institution.mode='autonomous';
//          owner.tokenVersion++; institution.employmentType→rent. audit: TOGGLE_MODE (grant)
{ institution: InstitutionListItem }
```
### POST /institutions/:id/revoke-admin   → reverse (mode→managed, removes 'admin', tokenVersion++)
### POST /institutions/:id/suspend | /reactivate   → status flip; suspend bumps institution.tokenVersion
### POST /institutions/:id/terminate   → status='terminated' (permanent; data retained)

### POST /institutions/:id/impersonate
```typescript
// req
{ panel: 'admin'|'teacher'|'student'; targetUserId?: string }   // targetUserId for teacher/student
// data
{ url: string;            // e.g. https://<PLATFORM_DOMAIN>/<slug>/admin?imp=1
  expiresInSec: number }  // short-lived god-token set as the matching inst_* cookie
// audit: IMPERSONATE_START (actorRole superadmin)
```

### GET /students   → Paginated<OperatorStudentRow>   (CROSS-INSTITUTION)
### POST  /students                 → god-mode enrol into ANY institution { institutionId, name, mobile, ...CREATE_FIELDS }
### GET   /students/:id             → full OperatorStudentDetail (parity with admin StudentDetail)
### GET   /students/:id/catalog     → that student's OWN-institution catalog { instruments, teachers, batches, dayPatterns, classLevels } for the edit form
### PATCH /students/:id             → god-mode edit; refs refGuard'd to the student's own institution; audited per-diff
```typescript
// query: ?search=&institutionId=&status=&joinStatus=&instrumentId=&teacherId=
interface OperatorStudentRow {
  _id: string; displayId: string; name: string; mobile: string; email: string|null;
  institution: { _id: string; name: string; slug: string };   // the TAG
  teacher: { _id: string; name: string } | null;              // the TAG
  batch: { _id: string; name: string } | null;
  instrument: string | null;
  classLevel: { _id: string; name: string } | null;
  joinStatus: 'trial'|'active_soon'|'active'|'inactive';
  paymentStatus: 'unpaid'|'partial'|'paid'|'free';            // DERIVED
  paidAmount: number; upcomingAmount: number; feeTotal: number;  // fee visible to operator
  remainingAmount: number; remarks: string | null;
  validityEnd: string | null;
  createdAt: string;
}
// CREATE/EDIT fields mirror the admin set (incl. classLevelId, feeTotal, remarks, status active|inactive|hold).
// paymentStatus DERIVED server-side; foreign teacher/batch/instrument/classLevel refs → 400 STUDENT_BAD_REFS.
```

### GET /teachers   → Paginated<OperatorTeacherRow>   (CROSS-INSTITUTION)
```typescript
// query: ?search=&institutionId=&employmentType=salary|rent&status=
interface OperatorTeacherRow {
  _id: string; displayId: string; name: string; mobile: string; email: string;
  altMobile: string | null; gender: 'male'|'female'|null;          // A7 (2026-06-12)
  dob: string | null; razorpayPaymentLink: string | null;          // A7 (2026-06-12)
  institution: { _id: string; name: string; slug: string };   // the TAG
  role: 'owner'|'staff';
  employmentType: 'salary'|'rent';
  amount: number | null;          // salaryAmount (managed) or institution rent (autonomous owner)
  activeBatches: number;
  status: 'active'|'inactive';
  createdAt: string;
}
// PATCH /teachers/:id also accepts altMobile (10-digit or empty), gender,
// dob (ISO date or empty), razorpayPaymentLink (https-only or empty) — audited per-diff.
```

### GET /credentials   → Paginated<CredentialRow>   (CRED 2026-06-12, CROSS-INSTITUTION)
```typescript
// query: ?role=teacher|student (required) &institutionId=&status=&search=&page=&limit=
// Identifiers ONLY — passwordHash/recoveryOtp are never selected or returned.
interface CredentialRow {
  _id: string; role: 'teacher'|'student'; displayId: string; name: string;
  email: string | null; mobile: string; mobileVerified: boolean;
  status: 'active'|'inactive'; lastLoginAt: string | null; createdAt: string;
  institution: { _id: string; name: string; slug: string } | null;
  panelAccess?: string[]; isOwner?: boolean;   // teacher rows
  joinStatus?: string;                          // student rows
}
```

### POST /credentials/reset-otp   → sends a step-up OTP (purpose 'reset_confirm')
###   to the OPERATOR'S OWN verified mobile. 400 MOBILE_NOT_VERIFIED if unverified.
###   God OTP is NOT accepted for step-up. Rate-limited (passwordResetLimiter 10/15min).

### POST /credentials/:role/:id/reset-password   { password? , otp? }   (one of the two)
###   Re-confirms the OPERATOR's identity (own password → 400 PASSWORD_INCORRECT on
###   mismatch — never 401; or reset_confirm OTP → 400 OTP_INVALID). On success:
###   bcrypt(temp) replaces the hash, target tokenVersion++ (logged out everywhere),
###   audit RESET_PASSWORD. data: { tempPassword /* shown ONCE, never persisted */, user }

### GET /payments   → Paginated<OperatorPaymentRow>   (student fees, CROSS-INSTITUTION)
```typescript
// query: ?institutionId=&status=&from=&to=
interface OperatorPaymentRow {
  _id: string; student: { _id: string; name: string };
  institution: { _id: string; name: string };               // the TAG
  type: 'fee'|'admission'; period: string|null; amount: number;
  status: 'paid'|'overdue'|'partial'|'free';
  method: 'razorpay'|'manual'|'cash'; paidAt: string|null;
}
// summary embedded in data alongside items+pagination: data.summary = { collectedThisMonth, overdue, pending }
```

### GET /rent-invoices   → Paginated<RentInvoiceItem>
```typescript
interface RentInvoiceItem { _id: string; institution: { _id: string; name: string };
  period: string; amount: number; dueDate: string;
  status: 'pending'|'paid'|'overdue'; paidAt: string|null; reference: string|null }
```
### POST /rent-invoices/:id/mark-paid   { reference?: string } → marks paid; audit: MARK_RENT_PAID

### GET /changes   → Paginated<AuditLogItem>   (GLOBAL audit timeline)
```typescript
// query: ?institutionId=&entityType=&action=&actorRole=&actorName=&from=&to=
interface AuditLogItem {
  _id: string; institution: { _id: string; name: string } | null;
  actorRole: 'superadmin'|'institution_admin'|'teacher'|'student'|'system';
  actorName: string; impersonatedBy: string | null;
  action: string; entityType: string; entityId: string; entityLabel: string | null;
  changes: { field: string; from: any; to: any }[];
  before: object | null; after: object | null; ip: string | null;
  createdAt: string;
}
```

### Settings: GET/PATCH /settings (profile incl. mobile/mobileVerified, godOtp
### status {isSet, updatedAt, lastUsedAt}, default rent, instrument master).
### PATCH /settings/god-otp — { newOtp: string /* 8-12 digits */, password: string }.
###   Re-verifies the superadmin's PASSWORD before storing the bcrypt hash; the
###   value is never returned or retrievable. data: { godOtp: { isSet, updatedAt, lastUsedAt } }
### POST /settings/mobile — { mobile } → stores unverified + sends verify code.
### POST /settings/mobile/verify — { otp } → { mobile, mobileVerified: true }.
### (TOTP 2FA endpoints REMOVED 2026-06-12 — operator login is single-step.)

---

# INSTITUTION ADMIN  — /api/inst/:slug/admin   (the 8 tabs)
All responses are implicitly scoped to the slug's institution. `institutionId` is never
accepted from the client — it comes from the resolved institution.

### New Requests
```
GET    /requests                 → Paginated<RequestItem>   ?status=pending|approved|rejected|all
POST   /requests                 { name, mobile, email?, preferredDayPatternId?, preferredTimeSlotId?, instrumentId?,
                                   proposed? }   // proposed = structured Add-Student form config (see below)
POST   /requests/:id/approve     { teacherId?, batchId?, instrumentId?, classLevelId?, classType?, gender?, category?,
                                   mode?, sessionType?, joinStatus?, validityStart?, validityEnd?, validityDays?,
                                   feeTotal?, paidAmount?, upcomingAmount?, paidClasses?, upcomingClasses?,
                                   remarks?, paymentStatus? }
                                   // body WINS; request.proposed supplies defaults. classLevelId pre-fills
                                   //   feeTotal/validityDays/paidAmount when omitted. paymentStatus is DERIVED
                                   //   (derivePaymentStatus; paymentStatus:'free' forces free) — never client-trusted.
                                   → creates Student (displayId issued), links request. audit: APPROVE_REQUEST
                                   → data: { student:{_id,displayId,name}, tempPassword }  // tempPassword surfaced ONCE (Phase 7 emails it)
POST   /requests/:id/reject      { reason? }
```
```typescript
interface RequestItem { _id: string; name: string; mobile: string; email: string|null;
  preferredDays: { _id: string; label: string } | null;
  preferredTime: { _id: string; label: string } | null;
  instrument: { _id: string; name: string } | null;
  proposed: ProposedConfig | null;   // serialized: ObjectId refs → string, Dates → ISO
  status: 'pending'|'approved'|'rejected'; paymentStatus: 'unpaid'|'paid'; createdAt: string }
// ProposedConfig: { classLevelId?, teacherId?, batchId?, instrumentId?, classType?, mode?, sessionType?,
//   joinStatus?, category?, gender?, validityStart?, validityEnd?, validityDays?, feeTotal?, paidAmount?,
//   paidClasses?, upcomingClasses?, remarks? } — refs validated against the institution at create-time.
```

### Students
```
GET   /students            → Paginated<StudentRow>   ?search=&status=&joinStatus=&teacherId=&batchId=
GET   /students/:id         → StudentDetail
POST  /students             (direct add; usually via request approval)
PATCH /students/:id         (any subset of editable fields — each diff is audited)
GET   /students/:id/activity → Paginated<AuditLogItem>   (the per-student feed, entityId=:id)
```
```typescript
interface StudentRow { _id: string; displayId: string; name: string; mobile: string;
  instrument: string|null; classType: string|null;
  schedule: { days: string|null; time: string|null };          // from batch
  joinStatus: 'trial'|'active_soon'|'active'|'inactive';
  paymentStatus: 'unpaid'|'partial'|'paid'|'free';             // DERIVED
  remainingAmount: number;                                     // feeTotal − paidAmount, clamped ≥0 (computed)
  validityEnd: string|null; teacher: { _id: string; name: string } | null }

interface StudentDetail extends StudentRow {
  accountStatus: 'active'|'inactive'|'hold';                   // status (distinct from joinStatus)
  email: string|null; gender: string|null; mode: 'online'|'offline';
  sessionType: 'live'|'all'; category: 'regular'|'trial';
  validityStart: string|null; validityDays: number|null;
  paidClasses: number; upcomingClasses: number;
  paidAmount: number; upcomingAmount: number;                  // the fee
  feeTotal: number; remarks: string|null;
  classLevel: { _id: string; name: string } | null;
  attendanceSummary: { total: number; present: number; absent: number };
  batch: { _id: string; name: string } | null;
  assignedVideoChapterId: string | null;
}
// PATCH editable: teacherId, batchId, instrumentId, classLevelId, gender, classType, mode, joinStatus,
//   sessionType, category, validityStart/End/Days, paidClasses, upcomingClasses, paidAmount,
//   upcomingAmount, feeTotal, remarks, status(active|inactive|hold)
// paymentStatus is DERIVED server-side (derivePaymentStatus) after any feeTotal/paidAmount change —
//   never client-assigned, but IS audited (UPDATE_PAID_AMOUNT when paidAmount/paymentStatus flips).
//   classLevelId is refGuard-validated; foreign ref → 400 STUDENT_BAD_REFS.
// NEVER returns: passwordHash, recoveryOtp
```

### Class Levels   (reusable fee+duration templates — admin "Class" tab)
```
GET    /class-levels        → { classLevels: ClassLevelItem[] }   ?active=1 (active only)
POST   /class-levels        { name, upcomingAmount, days, paidAmount? }   → 201 { classLevel }
PATCH  /class-levels/:id    { name?, upcomingAmount?, days?, paidAmount?, isActive? }
DELETE /class-levels/:id    → 400 CLASS_LEVEL_IN_USE if any student references it (deactivate instead)
```
```typescript
interface ClassLevelItem { _id: string; name: string; paidAmount: number; upcomingAmount: number;
  days: number; isActive: boolean }   // amounts in paise. audit: CREATE_/UPDATE_CLASS_LEVEL
```

### Teachers
```
GET   /teachers            → Paginated<TeacherRow>   ?search=&status=
POST  /teachers            { name, mobile, altMobile?, email, gender?, dob?, razorpayPaymentLink?, salaryAmount? }
PATCH /teachers/:id        (edit; toggling status; salary). audit on every diff
```
```typescript
interface TeacherRow { _id: string; displayId: string; name: string; mobile: string; email: string;
  role: 'owner'|'staff'; panelAccess: ('teacher'|'admin')[];
  activeBatches: number; performance: number|null; kpiPercent: number|null;
  status: 'active'|'inactive' }
// admin canNOT grant 'admin' panelAccess (operator-only); admin manages its own staff teachers.
```

### Batches
```
GET   /batches             → Paginated<BatchRow>   ?search=&status=
POST  /batches             { name?, instrumentId, dayPatternId, timeSlotId, teacherId? }   // name auto-encoded if omitted
PATCH /batches/:id         (reassign teacher, toggle status)
```
```typescript
interface BatchRow { _id: string; name: string;
  instrument: { _id: string; name: string } | null;
  dayPattern: { _id: string; label: string } | null;
  timeSlot: { _id: string; label: string } | null;
  teacher: { _id: string; name: string } | null;     // null ⇒ "Setting Phase"
  studentCount: number; status: 'setting'|'active'|'inactive'|'archived' }
```

### Attendance (grid)
```
GET /attendance   ?batchId=&from=&to=
```
```typescript
{ batch: { _id: string; name: string };
  dates: string[];                                   // columns
  rows: Array<{ student: { _id: string; name: string; displayId: string };
                marks: Record<string,'present'|'absent'|'holiday'|'credited'|'unmarked'> }> }
```

### Suitable Days / Suitable Times
```
GET   /day-patterns        → DayPatternItem[]
POST  /day-patterns        { days: ('mon'..'sun')[] }
PATCH /day-patterns/:id    { isActive }                 // the toggle
GET   /time-slots          → TimeSlotItem[]
POST  /time-slots          { startTime: 'HH:mm', endTime: 'HH:mm' }
PATCH /time-slots/:id      { isOnline }                 // the toggle
```
```typescript
interface DayPatternItem { _id: string; days: string[]; label: string; isActive: boolean }
interface TimeSlotItem  { _id: string; startTime: string; endTime: string; label: string; isOnline: boolean }
```

### Credentials   (CRED 2026-06-12 — institution-scoped mirror of the operator tab)
```
GET  /credentials                              → Paginated<CredentialRow (no institution field)>
                                                 ?role=teacher|student (required) &status=&search=&page=&limit=
POST /credentials/reset-otp                    → step-up OTP to the ACTING ADMIN's own verified mobile
                                                 (purpose 'reset_confirm'; 400 if impersonating or unverified)
POST /credentials/:role/:id/reset-password     { password? , otp? }  → { tempPassword /* ONCE */, user }
```
Reset re-confirms the acting admin's identity (own password — operator's when
impersonating via god-token, OTP path refused under impersonation). Target
tokenVersion++ → logged out everywhere; audit RESET_PASSWORD; identifiers only,
hashes never returned. Rate-limited (passwordResetLimiter).

### Payment History
```
GET /payments     → Paginated<PaymentRow>   ?status=&from=&to=
POST /payments     { studentId, type, amount, period?, method?, status, paidAt? }   // manual fee entry
GET /payments/reconciliation → Paginated<WebhookEventRow>   // read-only Razorpay feed
```
```typescript
interface PaymentRow { _id: string; student: { _id: string; name: string };
  type: 'fee'|'admission'; period: string|null; amount: number;
  status: 'paid'|'overdue'|'partial'|'free'; method: string; paidAt: string|null }
interface WebhookEventRow { _id: string; eventType: string; paymentId: string|null;
  amount: number|null; contact: string|null; payerName: string|null;
  status: string|null; receivedAt: string }
```

---

# INSTITUTION TEACHER  — /api/inst/:slug/teacher
```
GET    /me                       → { teacher: TeacherSelf, institution: BrandingPublic }
PATCH  /me                       { email, mobile }                → null   // teacher self-edit
GET    /batches                  → BatchRow[]   ?day=mon..sun
GET    /batches/:id              → BatchRow
GET    /batches/:id/students     → StudentRow[]
GET    /batches/:id/sessions     → Paginated<SessionRow>
POST   /batches/:id/sessions     { meetingUrl, targetDate? }      → SessionRow   // "Launch Session"
GET    /attendance               ?batchId=&date=  → { date, marks: Record<studentId, status> }
POST   /attendance/mark          { batchId, date, marks: { studentId, status: 'present'|'absent' }[] }
GET    /holidays                 → HolidayItem[]
POST   /holidays                 { batchId, date, studentCategory: 'regular'|'trial', reason? } → HolidayItem
DELETE /holidays/:id
GET    /colleagues               → TeacherKpiRow[]    // every teacher may view the roster
GET    /colleagues/:id/schedule  ?date=YYYY-MM-DD → { teacher, date, rows: (BatchRow & {launched})[] }
```
```typescript
interface TeacherSelf { _id: string; displayId: string; name: string; email: string;
  mobile: string; status: 'active'|'inactive'; activeBatches: number }
interface HolidayItem { _id: string; batch: { _id: string; name: string }; date: string;
  studentCategory: 'regular'|'trial'; reason: string|null }
interface SessionRow { _id: string; meetingUrl: string; targetDate: string;
  launchedAt: string; launchedBy: { actorRole: string } | null }
interface TeacherKpiRow { _id: string; displayId: string; name: string; email: string;
  mobile: string; status: 'active'|'inactive'; role: 'owner'|'staff'; since: string;
  kpiPercent: number; performance: number }   // KPI: config/teacherKpi.js (50/30/20 composite)
```
Marking attendance emits a Socket.io `attendance:marked` event to the institution room
(live updates). Client first GETs `/teacher/realtime-token` (see auth section) for the handshake.

---

# INSTITUTION STUDENT  — /api/inst/:slug/student
```
GET   /dashboard   → { upcomingClass, holidayNotice, attendance: { percent, present, total },
                       credentials: { displayId, schedule, sessionSlot },
                       validity: { start, end, days, paidClasses, upcomingClasses },   // A5 2026-06-12
                       timetable: ClassItem[] }
                     // upcomingClass also carries meetingUrl: string|null (B1+ 2026-06-12) —
                     // set ONLY for online batches with a ClassSession launched on that date.
GET   /classes     → Paginated<ClassItem>          // attendance history
GET   /timetable   → ClassItem[]
GET   /contact     → { teacher: { name, mobile } | null, support: { schoolName, email: string|null } }
                     // WHITE-LABEL: ONLY the student's own teacher + the institution's own
                     // contact (branding.schoolName + contactEmail). NO Max Music identifiers.
GET   /me          → { student: StudentSelf, institution: BrandingPublic }
PATCH /me          → limited profile fields (email, guardianName, guardianMobile)
```
```typescript
interface ClassItem { date: string; batchName: string; time: string;
  status: 'present'|'absent'|'upcoming'|'holiday' }
interface StudentSelf { _id: string; displayId: string; name: string; mobile: string;
  instrument: string|null; joinStatus: string; validityEnd: string|null }
// NEVER exposes Max Music School identifiers — only BrandingPublic (the institution).
```

---

# PLATFORM WEBHOOKS  — /api/webhooks   (PUBLIC, no panel cookie)
```
POST /api/webhooks/razorpay
```
```typescript
// Razorpay calls one URL. Mounted BEFORE the JSON parser with express.raw so the
// HMAC signature is verified against exact bytes. NOT rate-limited.
// Header: X-Razorpay-Signature: <hex>   verified (timing-safe) against RAZORPAY_WEBHOOK_SECRET.
//   invalid/missing signature → 400.   secret unconfigured → fails closed (400).
// Idempotent: duplicate (paymentId + event) → 200 "Already processed" (no re-store).
// Tenant attribution: from payload notes.institutionId or notes.slug; unattributed
//   events are still stored (institutionId omitted) for manual operator reconciliation.
// Writes ONLY the read-only RazorpayWebhookEvent feed — NEVER the Payment ledger.
// Responses: 200 OK (stored or duplicate) · 400 (bad sig/payload) · 500 (store failed → Razorpay retries)
```

---

# ERROR SHAPES
```typescript
// 400 { success:false, message:"Validation failed", data:{ errors:[{field,message}] } }
// 401 { success:false, message:"Authentication required", data:null }
// 403 { success:false, message:"Access denied", data:null }            // wrong panel / scope / suspended
// 404 { success:false, message:"<Entity> not found", data:null }        // also: unknown slug (never confirm existence)
// 429 { success:false, message:"Too many attempts", data:null }         // login rate limit
// 500 { success:false, message:"Internal server error", data:null }     // NEVER leak err.message/stack
```

---

# NOTES FOR AGENTS
1. **Backend:** add an endpoint's contract here before marking the task ✅. `institutionId`
   is NEVER read from the request body/query on `/inst/:slug/*` routes — it comes from the
   resolved institution.
2. **Frontend:** find the contract here before writing any `api.get/post`. Missing ⇒ backend
   task incomplete ⇒ mark BLOCKED.
3. **White-label:** institution-panel responses expose only `BrandingPublic`. Never send the
   operator/Max-Music name, logo, or domain to an institution panel.
4. **Secrets:** no response ever includes `passwordHash`, `recoveryOtp`, `totpSecret`.
