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
export type BatchStatus = "setting" | "active" | "inactive" | "archived";

// ── Branding (white-label safe) ───────────────────────────────────────────────

export interface BrandingPublic {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

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
