// TEMPORARY local mirror of CONTRACTS.md — replace with imports from
// @maxmusic/types at Handoff H2 (Dev A owns packages/types).
// Do NOT extend these shapes here; missing fields are requested from Dev A.

// ── Universal envelope ────────────────────────────────────────────────────────

export interface ApiResponse<T = null> {
  success: boolean; // true for 2xx, false otherwise
  message: string;
  data: T | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ── Shared unions ─────────────────────────────────────────────────────────────

export type JoinStatus = "trial" | "active_soon" | "active" | "inactive";
export type PanelAccess = "teacher" | "admin";
export type PaymentStatusValue = "paid" | "overdue" | "partial" | "free";
export type BatchStatus = "setting" | "active" | "inactive" | "archived";

// ── Branding (white-label safe) ───────────────────────────────────────────────

export interface BrandingPublic {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

// ── New Requests ──────────────────────────────────────────────────────────────

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

// ── Students ──────────────────────────────────────────────────────────────────

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

// ── Teachers ──────────────────────────────────────────────────────────────────

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

// ── Batches ───────────────────────────────────────────────────────────────────

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

// ── Attendance (grid) ─────────────────────────────────────────────────────────

export interface AttendanceGrid {
  batch: { _id: string; name: string };
  dates: string[]; // columns
  rows: Array<{
    student: { _id: string; name: string; displayId: string };
    marks: Record<string, "present" | "absent" | "holiday" | "credited" | "unmarked">;
  }>;
}

// ── Suitable Days / Suitable Times ────────────────────────────────────────────

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

// ── Payment History ───────────────────────────────────────────────────────────

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

// ── Holidays ──────────────────────────────────────────────────────────────────

export interface HolidayItem {
  _id: string;
  batch: { _id: string; name: string };
  date: string;
  studentCategory: "regular" | "trial";
  reason: string | null;
}

// ── Auth session (POST /api/inst/:slug/auth/admin/login · GET .../me) ────────

export interface AdminSession {
  user: {
    _id: string;
    name: string;
    role: "institution_admin";
    institutionId: string;
    panelAccess: PanelAccess[];
  };
  institution: BrandingPublic;
}

// ── Dashboard (GET /api/inst/:slug/admin/dashboard) ──────────────────────────

export interface AdminDashboardData {
  stats: {
    students: { total: number; trial: number; activeSoon: number; active: number; inactive: number };
    teachers: { active: number };
    batches: { active: number };
    feesThisMonth: number; // paise
  };
  todaysClasses: {
    _id: string;
    name: string;
    time: string | null;
    teacher: string | null;
    studentCount: number;
  }[];
  /** Last 12 months — new students per month + cumulative total. */
  enrollmentTrend: { month: string; newStudents: number; cumulative: number }[];
  /** Present-rate per batch over the last 30 days, worst first. */
  attendanceByBatch: {
    batchId: string;
    name: string;
    present: number;
    absent: number;
    total: number;
    rate: number; // 0-100
  }[];
}

// ── Batch detail (GET /batches/:id · /batches/:id/students · /sessions) ──────

export interface BatchDetail extends BatchRow {
  mode: "online" | "offline";
  dayPatternDays: string[];
  timeRange: { startTime: string; endTime: string } | null;
  createdAt: string;
}

export interface BatchStudentItem {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  joinStatus: JoinStatus;
  category: "regular" | "trial";
  validityEnd: string | null;
  paidClasses: number;
}

export interface ClassSessionItem {
  _id: string;
  meetingUrl: string;
  targetDate: string;
  launchedAt: string;
  launchedBy: { actorRole: string } | null;
}

/** One row per marked class date (GET /batches/:id/attendance-summary). */
export interface BatchAttendanceClass {
  date: string;
  present: number;
  absent: number;
  holiday: number;
  credited: number;
  total: number;
}

// ── School profile (GET /settings/profile · PATCH /settings/branding) ────────

export interface SchoolProfileData {
  branding: BrandingPublic;
  pendingSlugRequest: { _id: string; requestedSlug: string; createdAt: string } | null;
}

// ── Audit log (GET /students/:id/activity → Paginated<AuditLogItem>) ─────────

export interface AuditLogItem {
  _id: string;
  institution: { _id: string; name: string } | null;
  actorRole: "superadmin" | "institution_admin" | "teacher" | "student" | "system";
  actorName: string;
  impersonatedBy: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  changes: { field: string; from: unknown; to: unknown }[];
  before: object | null;
  after: object | null;
  ip: string | null;
  createdAt: string;
}
