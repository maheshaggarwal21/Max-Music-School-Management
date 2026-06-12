// H2 migration done — shared contract types come from @maxmusic/types
// (Dev A owns; Dev B reads). Per-panel view/row shapes remain local below.
import type {
  ApiResponse, Paginated, BrandingPublic,
  StudentJoinStatus as JoinStatus,
  InstitutionMode,
  InstitutionStatus,
  Panel as PanelAccess,
  ActorRole,
  PaymentRecordStatus as PaymentStatusValue,
  BatchStatus,
} from "@maxmusic/types";
export type {
  ApiResponse, Paginated, BrandingPublic,
  JoinStatus, InstitutionMode, InstitutionStatus,
  PanelAccess, ActorRole, PaymentStatusValue, BatchStatus,
};

// ── Operator: institutions ────────────────────────────────────────────────────

export interface InstitutionListItem {
  _id: string;
  name: string;
  slug: string;
  mode: InstitutionMode;
  status: InstitutionStatus;
  ownerTeacher: { _id: string; name: string; mobile: string } | null;
  studentCount: number;
  teacherCount: number;
  rentStatus: "paid" | "overdue" | "pending" | "na"; // na for managed
  branding: BrandingPublic;
  createdAt: string;
}

export interface InstitutionDetail extends InstitutionListItem {
  contactEmail: string;
  rent: { amount: number; billingCycle: string; nextDueDate: string } | null;
  counts: { batches: number; activeStudents: number; trialStudents: number };
}

// ── Operator: cross-institution rows ──────────────────────────────────────────

export interface OperatorStudentRow {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  email: string | null;
  institution: { _id: string; name: string; slug: string }; // the TAG
  teacher: { _id: string; name: string } | null;            // the TAG
  batch: { _id: string; name: string } | null;
  instrument: string | null;
  joinStatus: JoinStatus;
  paidAmount: number;
  upcomingAmount: number; // fee visible to operator
  validityEnd: string | null;
  createdAt: string;
}

export interface OperatorTeacherRow {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  email: string;
  altMobile: string | null;
  gender: "male" | "female" | null;
  dob: string | null;
  razorpayPaymentLink: string | null;
  institution: { _id: string; name: string; slug: string }; // the TAG
  role: "owner" | "staff";
  employmentType: "salary" | "rent";
  amount: number | null; // salaryAmount (managed) or institution rent (autonomous owner)
  activeBatches: number;
  status: "active" | "inactive";
  createdAt: string;
}

export interface OperatorPaymentRow {
  _id: string;
  student: { _id: string; name: string };
  institution: { _id: string; name: string }; // the TAG
  type: "fee" | "admission";
  period: string | null;
  amount: number;
  status: PaymentStatusValue;
  method: "razorpay" | "manual" | "cash";
  paidAt: string | null;
}

export interface RentInvoiceItem {
  _id: string;
  institution: { _id: string; name: string };
  period: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  paidAt: string | null;
  reference: string | null;
}

export interface AuditLogItem {
  _id: string;
  institution: { _id: string; name: string } | null;
  actorRole: ActorRole;
  actorName: string;
  impersonatedBy: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes?: { field: string; from: unknown; to: unknown }[];
  before: object | null;
  after: object | null;
  ip: string | null;
  createdAt: string;
}

// ── Institution admin panel shapes ────────────────────────────────────────────

export interface RequestItem {
  _id: string;
  name: string;
  mobile: string;
  email: string | null;
  preferredDays: { _id: string; label: string } | null;
  preferredTime: { _id: string; label: string } | null;
  instrument: { _id: string; name: string } | null;
  status: "pending" | "approved" | "rejected";
  paymentStatus: "unpaid" | "paid";
  createdAt: string;
}

export interface StudentRow {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  instrument: string | null;
  classType: string | null;
  schedule: { days: string | null; time: string | null }; // from batch
  joinStatus: JoinStatus;
  validityEnd: string | null;
  teacher: { _id: string; name: string } | null;
}

export interface StudentDetail extends StudentRow {
  email: string | null;
  gender: string | null;
  mode: "online" | "offline";
  sessionType: "live" | "all";
  category: "regular" | "trial";
  validityStart: string | null;
  validityDays: number | null;
  paidClasses: number;
  upcomingClasses: number;
  paidAmount: number;
  upcomingAmount: number; // the fee
  attendanceSummary: { total: number; present: number; absent: number };
  batch: { _id: string; name: string } | null;
  assignedVideoChapterId: string | null;
}

export interface TeacherRow {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  email: string;
  role: "owner" | "staff";
  panelAccess: PanelAccess[];
  activeBatches: number;
  performance: number | null;
  kpiPercent: number | null;
  status: "active" | "inactive";
}

export interface BatchRow {
  _id: string;
  name: string;
  instrument: { _id: string; name: string } | null;
  dayPattern: { _id: string; label: string } | null;
  timeSlot: { _id: string; label: string } | null;
  teacher: { _id: string; name: string } | null; // null ⇒ "Setting Phase"
  studentCount: number;
  status: BatchStatus;
}

export interface DayPatternItem {
  _id: string;
  days: string[];
  label: string;
  isActive: boolean;
}

export interface TimeSlotItem {
  _id: string;
  startTime: string;
  endTime: string;
  label: string;
  isOnline: boolean;
}

export interface PaymentRow {
  _id: string;
  student: { _id: string; name: string };
  type: "fee" | "admission";
  period: string | null;
  amount: number;
  status: PaymentStatusValue;
  method: string;
  paidAt: string | null;
}

export interface WebhookEventRow {
  _id: string;
  eventType: string;
  paymentId: string | null;
  amount: number | null;
  contact: string | null;
  payerName: string | null;
  status: string | null;
  receivedAt: string;
}

// ── Institution teacher panel shapes ──────────────────────────────────────────

export interface TeacherSelf {
  _id: string;
  displayId: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "inactive";
  activeBatches: number;
}

export interface HolidayItem {
  _id: string;
  batch: { _id: string; name: string };
  date: string;
  studentCategory: "regular" | "trial";
  reason: string | null;
}

// ── Institution student panel shapes ──────────────────────────────────────────

export interface ClassItem {
  date: string;
  batchName: string;
  time: string;
  status: "present" | "absent" | "upcoming" | "holiday";
}

export interface StudentSelf {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  instrument: string | null;
  joinStatus: string;
  validityEnd: string | null;
}

// ── Operator auth (mirrors CONTRACTS.md "AUTH") ───────────────────────────────
// Single step (TOTP 2FA removed 2026-06-12): POST /login (email+password) or
// POST /otp/request + /otp/verify (mobile) → data.operator + operator_token cookie.

export interface OperatorProfile {
  _id: string;
  name: string;
  email: string;
  role: "superadmin";
}

// ── Operator dashboard (mirrors CONTRACTS.md GET /api/operator/dashboard) ────

export interface OperatorDashboardData {
  institutions: { total: number; active: number; suspended: number };
  totals: { students: number; teachers: number };
  revenue: {
    rentCollectedThisMonth: number;
    rentOverdue: number;
    feeCollectedThisMonth: number;
    feeTrend: { month: string; collected: number }[];
  };
  recentChanges: AuditLogItem[]; // last N across all institutions
  overdueRents: RentInvoiceItem[];
}

// ── Operator settings (CONTRACTS.md lists GET/PATCH /settings + /settings/2fa
//    without a field-level shape — this mirror is the minimal read shape and is
//    flagged for Dev A to finalize in CONTRACTS.md) ──────────────────────────

export interface InstrumentMasterItem {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface OperatorSettingsData {
  profile: {
    name: string;
    email: string;
    mobile: string | null;
    mobileVerified: boolean;
  };
  /** Fail-safe master OTP status — the value itself is never returned. */
  godOtp: { isSet: boolean; updatedAt: string | null; lastUsedAt: string | null };
  defaultRent: { amount: number; billingCycle: "monthly" };
  /** Platform master catalog (PlatformSettings singleton) — offered to every institution. */
  instruments: InstrumentMasterItem[];
}

// ── Slug change requests (GET /api/operator/slug-requests) ───────────────────

export type SlugRequestStatus = "pending" | "approved" | "rejected";

export interface SlugChangeRequestRow {
  _id: string;
  institution: { _id: string; name?: string; slug?: string };
  currentSlug: string;
  requestedSlug: string;
  reason: string | null;
  status: SlugRequestStatus;
  requestedBy: { actorName: string | null } | null;
  handledAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
