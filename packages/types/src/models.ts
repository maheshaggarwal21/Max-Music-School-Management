// ─────────────────────────────────────────────────────────────────────────────
// Mirrors apps/api/src/models/* — one interface per Mongoose model.
// Source spec: .claude/orchestrate/data-model.md
// Dev A owns. Dev B reads.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────
export type InstitutionMode    = 'managed' | 'autonomous';
export type InstitutionStatus  = 'pending' | 'active' | 'suspended' | 'terminated';
export type EntityStatus       = 'active' | 'inactive';
export type Panel              = 'teacher' | 'admin';
export type StudentJoinStatus  = 'trial' | 'active_soon' | 'active' | 'inactive';
export type StudentMode        = 'online' | 'offline';
export type StudentSessionType = 'live' | 'all';
export type StudentCategory    = 'regular' | 'trial';
export type RequestStatus      = 'pending' | 'approved' | 'rejected';
export type PaymentStatus      = 'unpaid' | 'paid';
export type BatchStatus        = 'setting' | 'active' | 'inactive' | 'archived';
export type EmploymentType     = 'salary' | 'rent';
export type Day                = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type AttendanceStatus   = 'present' | 'absent' | 'holiday' | 'credited';
export type PaymentType        = 'fee' | 'admission';
export type PaymentRecordStatus = 'paid' | 'overdue' | 'partial' | 'free';
export type PaymentMethod      = 'razorpay' | 'manual' | 'cash';
export type RentInvoiceStatus  = 'pending' | 'paid' | 'overdue';
export type ActorRole = 'superadmin' | 'institution_admin' | 'teacher' | 'student' | 'system';

// ── Subdocuments ─────────────────────────────────────────────────────────────
export interface Branding {
  schoolName: string;
  logoUrl?: string | null;
  primaryColor: string;
  tagline?: string | null;
}

export interface BrandingPublic {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

export interface Rent {
  amount: number;
  billingCycle: 'monthly';
  nextDueDate?: string | null;
}

export interface ActorRef {
  actorId: string;
  actorRole: ActorRole;
}

// ── Platform-level ───────────────────────────────────────────────────────────
export interface Operator {
  _id: string;
  name: string;
  email: string;
  role: 'superadmin';
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Institution {
  _id: string;
  name: string;
  slug: string;
  mode: InstitutionMode;
  status: InstitutionStatus;
  ownerTeacherId?: string | null;
  createdByOperatorId: string;
  contactEmail: string;
  branding: Branding;
  rent?: Rent | null;
  activatedAt?: string | null;
  suspendedAt?: string | null;
  terminatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentInvoice {
  _id: string;
  institutionId: string;
  period: string;
  amount: number;
  dueDate: string;
  status: RentInvoiceStatus;
  paidAt?: string | null;
  reference?: string | null;
  markedByOperatorId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayWebhookEvent {
  _id: string;
  institutionId?: string | null;
  eventType: string;
  paymentId?: string | null;
  amount?: number | null;
  contact?: string | null;
  payerName?: string | null;
  status?: string | null;
  rawPayload: unknown;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ── Institution-scoped ───────────────────────────────────────────────────────
export interface Teacher {
  _id: string;
  institutionId: string;
  displayId: string;
  name: string;
  email: string;
  mobile: string;
  altMobile?: string | null;
  gender?: 'male' | 'female' | null;
  dob?: string | null;
  profilePicUrl?: string | null;
  razorpayPaymentLink?: string | null;
  isOwner: boolean;
  panelAccess: Panel[];
  employmentType?: EmploymentType | null;
  salaryAmount?: number | null;
  performance?: number | null;
  kpiPercent?: number | null;
  status: EntityStatus;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  _id: string;
  institutionId: string;
  displayId: string;
  teacherId?: string | null;
  batchId?: string | null;
  name: string;
  mobile: string;
  email?: string | null;
  gender?: 'male' | 'female' | null;
  profilePicUrl?: string | null;
  instrumentId?: string | null;
  classType?: string | null;
  mode: StudentMode;
  joinStatus: StudentJoinStatus;
  sessionType: StudentSessionType;
  category: StudentCategory;
  validityStart?: string | null;
  validityEnd?: string | null;
  validityDays?: number | null;
  paidClasses: number;
  upcomingClasses: number;
  paidAmount: number;
  upcomingAmount: number;
  requestId?: string | null;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentRequest {
  _id: string;
  institutionId: string;
  name: string;
  mobile: string;
  email?: string | null;
  preferredDayPatternId?: string | null;
  preferredTimeSlotId?: string | null;
  instrumentId?: string | null;
  status: RequestStatus;
  paymentStatus: PaymentStatus;
  approvedStudentId?: string | null;
  handledBy?: ActorRef | null;
  handledAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  _id: string;
  institutionId: string;
  name: string;
  instrumentId?: string | null;
  dayPatternId?: string | null;
  timeSlotId?: string | null;
  teacherId?: string | null;
  mode: StudentMode;
  studentCount: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DayPattern {
  _id: string;
  institutionId: string;
  days: Day[];
  label: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  _id: string;
  institutionId: string;
  startTime: string;
  endTime: string;
  label: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Instrument {
  _id: string;
  institutionId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  _id: string;
  institutionId: string;
  batchId: string;
  studentId: string;
  teacherId?: string | null;
  date: string;
  status: AttendanceStatus;
  markedBy?: ActorRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  _id: string;
  institutionId: string;
  batchId: string;
  date: string;
  studentCategory: StudentCategory;
  reason?: string | null;
  creditsApplied: boolean;
  createdBy?: ActorRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  institutionId: string;
  studentId: string;
  teacherId?: string | null;
  type: PaymentType;
  period?: string | null;
  amount: number;
  status: PaymentRecordStatus;
  method: PaymentMethod;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
  recordedBy?: ActorRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditLog {
  _id: string;
  institutionId: string;
  actorId: string;
  actorRole: ActorRole;
  actorName: string;
  impersonatedBy?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  changes?: AuditLogChange[];
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  createdAt: string;
}
