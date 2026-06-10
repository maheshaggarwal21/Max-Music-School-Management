// H2 migration done — shared contract types come from @maxmusic/types
// (Dev A owns; Dev B reads). Per-panel view/row shapes remain local below.
import type {
  ApiResponse, Paginated, BrandingPublic,
  StudentJoinStatus as JoinStatus,
  Panel as PanelAccess,
  PaymentRecordStatus as PaymentStatusValue,
  BatchStatus,
} from "@maxmusic/types";
export type {
  ApiResponse, Paginated, BrandingPublic,
  JoinStatus, PanelAccess, PaymentStatusValue, BatchStatus,
};

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
