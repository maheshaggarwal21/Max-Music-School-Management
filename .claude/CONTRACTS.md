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

### POST /api/auth/operator/login  →  (step 1)
```typescript
// req
{ email: string; password: string }
// data — when 2FA required
{ twoFactorRequired: true; challengeToken: string }   // no session cookie yet
```
### POST /api/auth/operator/verify-2fa  →  (step 2)
```typescript
// req
{ challengeToken: string; code: string }   // TOTP 6-digit
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
### POST .../logout   → clears the respective cookie; data: null
### GET  .../me        → current user + (for institution panels) BrandingPublic

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
```typescript
// query: ?search=&institutionId=&status=&joinStatus=&instrumentId=&teacherId=
interface OperatorStudentRow {
  _id: string; displayId: string; name: string; mobile: string; email: string|null;
  institution: { _id: string; name: string; slug: string };   // the TAG
  teacher: { _id: string; name: string } | null;              // the TAG
  batch: { _id: string; name: string } | null;
  instrument: string | null;
  joinStatus: 'trial'|'active_soon'|'active'|'inactive';
  paidAmount: number; upcomingAmount: number;                 // fee visible to operator
  validityEnd: string | null;
  createdAt: string;
}
```

### GET /teachers   → Paginated<OperatorTeacherRow>   (CROSS-INSTITUTION)
```typescript
// query: ?search=&institutionId=&employmentType=salary|rent&status=
interface OperatorTeacherRow {
  _id: string; displayId: string; name: string; mobile: string; email: string;
  institution: { _id: string; name: string; slug: string };   // the TAG
  role: 'owner'|'staff';
  employmentType: 'salary'|'rent';
  amount: number | null;          // salaryAmount (managed) or institution rent (autonomous owner)
  activeBatches: number;
  status: 'active'|'inactive';
  createdAt: string;
}
```

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

### Settings: GET/PATCH /settings (profile, default rent, instrument master, email templates);
### POST /settings/2fa/enable | /disable.

---

# INSTITUTION ADMIN  — /api/inst/:slug/admin   (the 8 tabs)
All responses are implicitly scoped to the slug's institution. `institutionId` is never
accepted from the client — it comes from the resolved institution.

### New Requests
```
GET    /requests                 → Paginated<RequestItem>   ?status=pending|approved|rejected|all
POST   /requests                 { name, mobile, email?, preferredDayPatternId?, preferredTimeSlotId?, instrumentId? }
POST   /requests/:id/approve     { teacherId?, batchId?, instrumentId?, classType?, validityDays?, paidAmount?, paymentStatus? }
                                   → creates Student (displayId issued), links request. audit: APPROVE_REQUEST
                                   → data: { student:{_id,displayId,name}, tempPassword }  // tempPassword surfaced ONCE (Phase 7 emails it)
POST   /requests/:id/reject      { reason? }
```
```typescript
interface RequestItem { _id: string; name: string; mobile: string; email: string|null;
  preferredDays: { _id: string; label: string } | null;
  preferredTime: { _id: string; label: string } | null;
  instrument: { _id: string; name: string } | null;
  status: 'pending'|'approved'|'rejected'; paymentStatus: 'unpaid'|'paid'; createdAt: string }
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
  validityEnd: string|null; teacher: { _id: string; name: string } | null }

interface StudentDetail extends StudentRow {
  email: string|null; gender: string|null; mode: 'online'|'offline';
  sessionType: 'live'|'all'; category: 'regular'|'trial';
  validityStart: string|null; validityDays: number|null;
  paidClasses: number; upcomingClasses: number;
  paidAmount: number; upcomingAmount: number;                  // the fee
  attendanceSummary: { total: number; present: number; absent: number };
  batch: { _id: string; name: string } | null;
  assignedVideoChapterId: string | null;
}
// PATCH editable: teacherId, batchId, instrumentId, classType, mode, joinStatus, sessionType,
//   category, validityStart/End/Days, paidClasses, upcomingClasses, paidAmount, upcomingAmount, status
// NEVER returns: passwordHash, recoveryOtp
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
                       credentials: { displayId, schedule, sessionSlot }, timetable: ClassItem[] }
GET   /classes     → Paginated<ClassItem>          // attendance history
GET   /timetable   → ClassItem[]
GET   /me          → { student: StudentSelf, institution: BrandingPublic }
PATCH /me          → limited profile fields
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
