// H2 migration done — shared contract types come from @maxmusic/types
// (Dev A owns; Dev B reads). Per-panel view/row shapes remain local below.
import type {
  ApiResponse, Paginated, BrandingPublic,
  StudentJoinStatus as JoinStatus,
  BatchStatus,
} from "@maxmusic/types";
export type { ApiResponse, Paginated, BrandingPublic, JoinStatus, BatchStatus };

// ── Auth ──────────────────────────────────────────────────────────────────────

// POST /api/inst/:slug/auth/teacher/login body
export interface TeacherLoginPayload {
  mobile: string;
  password: string;
}

// POST /api/inst/:slug/auth/teacher/login → data  (cookie inst_teacher_token is httpOnly)
export interface TeacherLoginData {
  user: {
    _id: string;
    name: string;
    role: "teacher";
    institutionId: string;
    panelAccess: ("teacher" | "admin")[];
  };
  institution: BrandingPublic;
}

// ── Me ────────────────────────────────────────────────────────────────────────

// GET /api/inst/:slug/teacher/me → data
export interface TeacherMeData {
  teacher: TeacherSelf;
  institution: BrandingPublic;
}

export interface TeacherSelf {
  _id: string;
  displayId: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "inactive";
  activeBatches: number;
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

// GET /batches/:id/students → StudentRow[]
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

// ── Attendance ────────────────────────────────────────────────────────────────

export type AttendanceMarkStatus = "present" | "absent";

// POST /attendance/mark body
export interface AttendanceMarkPayload {
  batchId: string;
  date: string;
  marks: { studentId: string; status: AttendanceMarkStatus }[];
}

// Full mark vocabulary as it appears in the admin attendance grid (CONTRACTS.md
// admin GET /attendance). The teacher POST contract accepts only present|absent
// today — holiday/credited are display states.
export type AttendanceCellStatus =
  | "present"
  | "absent"
  | "holiday"
  | "credited"
  | "unmarked";

// GET /attendance ?batchId=&date= (teacher) — response shape not yet pinned in
// CONTRACTS.md; TEMPORARY assumption mirroring the admin grid for one date.
// Confirm with Dev A before H5 wiring.
export interface AttendanceDay {
  batch: { _id: string; name: string };
  date: string;
  marks: Record<string, AttendanceCellStatus>; // studentId → status
}

// ── Classes ───────────────────────────────────────────────────────────────────

export interface ClassItem {
  date: string;
  batchName: string;
  time: string;
  status: "present" | "absent" | "upcoming" | "holiday";
}

// ── Holidays ──────────────────────────────────────────────────────────────────

export interface HolidayItem {
  _id: string;
  batch: { _id: string; name: string };
  date: string;
  studentCategory: "regular" | "trial";
  reason: string | null;
}

// POST /holidays body
export interface HolidayCreatePayload {
  batchId: string;
  date: string;
  studentCategory: "regular" | "trial";
  reason?: string;
}

// ── Class sessions (batch Overview "Launch Session" + archive) ────────────────

export interface SessionRow {
  _id: string;
  meetingUrl: string;
  targetDate: string;
  launchedAt: string;
  launchedBy: { actorRole: string } | null;
}

// POST /batches/:id/sessions body
export interface LaunchSessionPayload {
  meetingUrl: string;
  targetDate?: string;
}

// ── Teachers roster + KPIs (every teacher may view) ───────────────────────────

export interface TeacherKpiRow {
  _id: string;
  displayId: string;
  name: string;
  email: string;
  mobile: string;
  status: "active" | "inactive";
  role: "owner" | "staff";
  since: string;
  kpiPercent: number;
  performance: number; // 0.0 – 5.0
}

// GET /colleagues/:id/schedule → data
export interface ColleagueSchedule {
  teacher: { _id: string; name: string; displayId: string; status: "active" | "inactive" };
  date: string | null;
  rows: ScheduleRow[];
}

export type ScheduleRow = BatchRow & { launched: boolean };
