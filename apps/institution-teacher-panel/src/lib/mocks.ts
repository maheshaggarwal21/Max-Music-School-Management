// SINGLE source of mock data for the institution teacher panel (MOCK MODE —
// NEXT_PUBLIC_API_URL unset). Every page resolves data through
// mockable(realCall, MOCK_X) from ./api.
//
// WHITE-LABEL: branding below is a fictional INSTITUTION — never the operator.
// All dates are in 2026.

import type {
  ApiResponse,
  AttendanceDay,
  BatchRow,
  BrandingPublic,
  ColleagueSchedule,
  HolidayItem,
  SessionRow,
  StudentRow,
  TeacherKpiRow,
  TeacherLoginData,
  TeacherMeData,
  TeacherSelf,
} from "./types";
import { toIsoDate } from "./schedule";

// ── Branding (the ONLY identity this panel ever shows) ───────────────────────

export const MOCK_BRANDING: BrandingPublic = {
  slug: "sunrise-school-of-music",
  schoolName: "Sunrise School of Music",
  logoUrl: null,
  primaryColor: "#E8772E", // warm sunrise orange — institution accent
  tagline: "Where every note finds its light",
};

// ── Me ────────────────────────────────────────────────────────────────────────

export const MOCK_TEACHER: TeacherSelf = {
  _id: "tch-014",
  displayId: "SSM-T-014",
  name: "Aarav Mehta",
  email: "aarav.mehta@example.com",
  mobile: "9876543210",
  mobileVerified: true,
  status: "active",
  activeBatches: 5,
};

export const MOCK_ME: ApiResponse<TeacherMeData> = {
  success: true,
  message: "OK",
  data: { teacher: MOCK_TEACHER, institution: MOCK_BRANDING },
};

export const MOCK_LOGIN: ApiResponse<TeacherLoginData> = {
  success: true,
  message: "Logged in",
  data: {
    user: {
      _id: "tch-014",
      name: "Aarav Mehta",
      role: "teacher",
      institutionId: "inst-sunrise",
      panelAccess: ["teacher"],
    },
    institution: MOCK_BRANDING,
  },
};

// panelAccess for the profile page; in real mode this arrives via the login
// response (GET /me does not include it yet — flagged to Dev A).
export const MOCK_PANEL_ACCESS: ("teacher" | "admin")[] = ["teacher"];

// ── Batches ───────────────────────────────────────────────────────────────────

export const MOCK_BATCHES: BatchRow[] = [
  {
    _id: "bat-01",
    name: "GTR-MWF-5PM",
    instrument: { _id: "ins-gtr", name: "Guitar" },
    dayPattern: { _id: "dp-mwf", label: "Mon · Wed · Fri" },
    timeSlot: { _id: "ts-17", label: "5:00 PM – 6:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 8,
    status: "active",
  },
  {
    _id: "bat-02",
    name: "PNO-TT-6PM",
    instrument: { _id: "ins-pno", name: "Piano" },
    dayPattern: { _id: "dp-tt", label: "Tue · Thu" },
    timeSlot: { _id: "ts-18", label: "6:00 PM – 7:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 6,
    status: "active",
  },
  {
    _id: "bat-03",
    name: "VOC-WS-11AM",
    instrument: { _id: "ins-voc", name: "Vocals" },
    dayPattern: { _id: "dp-ws", label: "Wed · Sat" },
    timeSlot: { _id: "ts-11", label: "11:00 AM – 12:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 10,
    status: "active",
  },
  {
    _id: "bat-04",
    name: "DRM-SS-4PM",
    instrument: { _id: "ins-drm", name: "Drums" },
    dayPattern: { _id: "dp-ss", label: "Sat · Sun" },
    timeSlot: { _id: "ts-16", label: "4:00 PM – 5:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 5,
    status: "active",
  },
  {
    _id: "bat-05",
    name: "GTR-MWF-7PM",
    instrument: { _id: "ins-gtr", name: "Guitar" },
    dayPattern: { _id: "dp-mwf", label: "Mon · Wed · Fri" },
    timeSlot: { _id: "ts-19", label: "7:00 PM – 8:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 3,
    status: "setting",
  },
  {
    _id: "bat-06",
    name: "KEY-TT-5PM",
    instrument: { _id: "ins-key", name: "Keyboard" },
    dayPattern: { _id: "dp-tt", label: "Tue · Thu" },
    timeSlot: { _id: "ts-17", label: "5:00 PM – 6:00 PM" },
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
    studentCount: 0,
    status: "inactive",
  },
];

export const MOCK_BATCHES_RESPONSE: ApiResponse<BatchRow[]> = {
  success: true,
  message: "OK",
  data: MOCK_BATCHES,
};

export function mockBatchInfoResponse(batchId: string): ApiResponse<BatchRow | null> {
  return {
    success: true,
    message: "OK",
    data: MOCK_BATCHES.find((b) => b._id === batchId) ?? null,
  };
}

// ── Students per batch ────────────────────────────────────────────────────────

function student(
  id: string,
  displayId: string,
  name: string,
  mobile: string,
  batch: BatchRow,
  joinStatus: StudentRow["joinStatus"],
  validityEnd: string | null
): StudentRow {
  return {
    _id: id,
    displayId,
    name,
    mobile,
    instrument: batch.instrument?.name ?? null,
    classType: "Group",
    schedule: {
      days: batch.dayPattern?.label ?? null,
      time: batch.timeSlot?.label ?? null,
    },
    joinStatus,
    validityEnd,
    teacher: { _id: "tch-014", name: "Aarav Mehta" },
  };
}

const b1 = MOCK_BATCHES[0];
const b2 = MOCK_BATCHES[1];
const b3 = MOCK_BATCHES[2];
const b4 = MOCK_BATCHES[3];
const b5 = MOCK_BATCHES[4];

export const MOCK_BATCH_STUDENTS: Record<string, StudentRow[]> = {
  "bat-01": [
    student("stu-101", "SSM-S-101", "Priya Sharma", "9811001101", b1, "active", "2026-08-14"),
    student("stu-102", "SSM-S-102", "Kabir Anand", "9811001102", b1, "active", "2026-07-30"),
    student("stu-103", "SSM-S-103", "Ishita Rao", "9811001103", b1, "active", "2026-09-02"),
    student("stu-104", "SSM-S-104", "Rohan Gupta", "9811001104", b1, "trial", null),
    student("stu-105", "SSM-S-105", "Ananya Iyer", "9811001105", b1, "active", "2026-07-18"),
    student("stu-106", "SSM-S-106", "Dev Patel", "9811001106", b1, "active_soon", "2026-08-25"),
    student("stu-107", "SSM-S-107", "Meera Krishnan", "9811001107", b1, "active", "2026-10-01"),
    student("stu-108", "SSM-S-108", "Arjun Nair", "9811001108", b1, "inactive", "2026-05-20"),
  ],
  "bat-02": [
    student("stu-201", "SSM-S-201", "Sara Khan", "9811002201", b2, "active", "2026-08-08"),
    student("stu-202", "SSM-S-202", "Vivaan Joshi", "9811002202", b2, "active", "2026-09-15"),
    student("stu-203", "SSM-S-203", "Naina Kapoor", "9811002203", b2, "trial", null),
    student("stu-204", "SSM-S-204", "Aditya Verma", "9811002204", b2, "active", "2026-07-22"),
    student("stu-205", "SSM-S-205", "Zoya Sheikh", "9811002205", b2, "active", "2026-08-30"),
    student("stu-206", "SSM-S-206", "Krish Malhotra", "9811002206", b2, "active_soon", "2026-09-05"),
  ],
  "bat-03": [
    student("stu-301", "SSM-S-301", "Tara Bhatt", "9811003301", b3, "active", "2026-08-19"),
    student("stu-302", "SSM-S-302", "Reyansh Saxena", "9811003302", b3, "active", "2026-07-25"),
    student("stu-303", "SSM-S-303", "Avni Desai", "9811003303", b3, "active", "2026-09-12"),
    student("stu-304", "SSM-S-304", "Yuvraj Singh", "9811003304", b3, "trial", null),
    student("stu-305", "SSM-S-305", "Kiara Menon", "9811003305", b3, "active", "2026-10-08"),
    student("stu-306", "SSM-S-306", "Aryan Chopra", "9811003306", b3, "active", "2026-08-02"),
    student("stu-307", "SSM-S-307", "Diya Reddy", "9811003307", b3, "active", "2026-09-28"),
    student("stu-308", "SSM-S-308", "Vihaan Das", "9811003308", b3, "active_soon", "2026-08-21"),
    student("stu-309", "SSM-S-309", "Anvi Kulkarni", "9811003309", b3, "active", "2026-07-29"),
    student("stu-310", "SSM-S-310", "Shaurya Pillai", "9811003310", b3, "trial", null),
  ],
  "bat-04": [
    student("stu-401", "SSM-S-401", "Advait Bose", "9811004401", b4, "active", "2026-08-16"),
    student("stu-402", "SSM-S-402", "Myra Dutta", "9811004402", b4, "active", "2026-09-09"),
    student("stu-403", "SSM-S-403", "Laksh Agarwal", "9811004403", b4, "active", "2026-07-31"),
    student("stu-404", "SSM-S-404", "Pari Trivedi", "9811004404", b4, "trial", null),
    student("stu-405", "SSM-S-405", "Neil Fernandes", "9811004405", b4, "active", "2026-08-27"),
  ],
  "bat-05": [
    student("stu-501", "SSM-S-501", "Aisha Mirza", "9811005501", b5, "trial", null),
    student("stu-502", "SSM-S-502", "Ritvik Hegde", "9811005502", b5, "active_soon", "2026-09-18"),
    student("stu-503", "SSM-S-503", "Inaaya Syed", "9811005503", b5, "trial", null),
  ],
  "bat-06": [],
};

export function mockBatchStudentsResponse(batchId: string): ApiResponse<StudentRow[]> {
  return {
    success: true,
    message: "OK",
    data: MOCK_BATCH_STUDENTS[batchId] ?? [],
  };
}

// ── Attendance ────────────────────────────────────────────────────────────────

/** A fresh (unmarked) attendance sheet for a batch + date. */
export function mockAttendanceDayResponse(
  batchId: string,
  date: string
): ApiResponse<AttendanceDay> {
  const batch = MOCK_BATCHES.find((b) => b._id === batchId);
  const roster = MOCK_BATCH_STUDENTS[batchId] ?? [];
  const today = toIsoDate(new Date());
  const marks: AttendanceDay["marks"] = {};
  for (const [i, s] of roster.entries()) {
    // Past dates come back pre-marked (mostly present); today/future unmarked.
    marks[s._id] =
      date < today ? (i % 5 === 3 ? "absent" : "present") : "unmarked";
  }
  return {
    success: true,
    message: "OK",
    data: {
      batch: { _id: batchId, name: batch?.name ?? "" },
      date,
      marks,
    },
  };
}

export const MOCK_MARK_OK: ApiResponse<null> = {
  success: true,
  message: "Attendance saved",
  data: null,
};

// ── Holidays ──────────────────────────────────────────────────────────────────

// Institution-declared holidays (read-only for teachers).
export const MOCK_INSTITUTION_HOLIDAYS: HolidayItem[] = [
  {
    _id: "hol-01",
    batch: { _id: "bat-01", name: "GTR-MWF-5PM" },
    date: "2026-06-17",
    studentCategory: "regular",
    reason: "Summer recital rehearsal day",
  },
  {
    _id: "hol-02",
    batch: { _id: "bat-03", name: "VOC-WS-11AM" },
    date: "2026-06-20",
    studentCategory: "regular",
    reason: "Studio maintenance",
  },
  {
    _id: "hol-03",
    batch: { _id: "bat-02", name: "PNO-TT-6PM" },
    date: "2026-08-15",
    studentCategory: "regular",
    reason: "Independence Day",
  },
  {
    _id: "hol-04",
    batch: { _id: "bat-04", name: "DRM-SS-4PM" },
    date: "2026-10-20",
    studentCategory: "trial",
    reason: "Diwali break",
  },
];

// Holidays this teacher requested earlier (already created via POST /holidays).
export const MOCK_MY_HOLIDAYS: HolidayItem[] = [
  {
    _id: "myh-01",
    batch: { _id: "bat-01", name: "GTR-MWF-5PM" },
    date: "2026-05-29",
    studentCategory: "regular",
    reason: "Personal — family function",
  },
  {
    _id: "myh-02",
    batch: { _id: "bat-02", name: "PNO-TT-6PM" },
    date: "2026-06-25",
    studentCategory: "regular",
    reason: "Workshop at partner studio",
  },
];

export const MOCK_INSTITUTION_HOLIDAYS_RESPONSE: ApiResponse<HolidayItem[]> = {
  success: true,
  message: "OK",
  data: MOCK_INSTITUTION_HOLIDAYS,
};

export const MOCK_MY_HOLIDAYS_RESPONSE: ApiResponse<HolidayItem[]> = {
  success: true,
  message: "OK",
  data: MOCK_MY_HOLIDAYS,
};

export function mockCreatedHoliday(
  batchId: string,
  date: string,
  studentCategory: "regular" | "trial",
  reason?: string
): ApiResponse<HolidayItem> {
  const batch = MOCK_BATCHES.find((b) => b._id === batchId);
  return {
    success: true,
    message: "Holiday requested",
    data: {
      _id: `myh-${Date.now()}`,
      batch: { _id: batchId, name: batch?.name ?? "" },
      date,
      studentCategory,
      reason: reason ?? null,
    },
  };
}

// ── Class sessions (batch Overview "Launch Session" + archive) ────────────────

export function mockSessionsResponse(batchId: string): ApiResponse<{
  items: SessionRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const seed = MOCK_BATCHES.findIndex((b) => b._id === batchId);
  const base = seed >= 0 ? seed : 0;
  const items: SessionRow[] = Array.from({ length: 3 }).map((_, i) => ({
    _id: `ses-${batchId}-${i}`,
    meetingUrl: `https://zoom.us/j/${93000000 + base * 1000 + i}`,
    targetDate: `2026-06-0${Math.max(1, 6 - i)}`,
    launchedAt: `2026-06-0${Math.max(1, 6 - i)}T13:30:00.000Z`,
    launchedBy: { actorRole: "teacher" },
  }));
  return {
    success: true,
    message: "OK",
    data: { items, pagination: { page: 1, limit: 30, total: items.length, pages: 1 } },
  };
}

export function mockLaunchedSession(meetingUrl: string, targetDate?: string): ApiResponse<SessionRow> {
  return {
    success: true,
    message: "Session launched",
    data: {
      _id: `ses-${Date.now()}`,
      meetingUrl,
      targetDate: targetDate ?? toIsoDate(new Date()),
      launchedAt: new Date().toISOString(),
      launchedBy: { actorRole: "teacher" },
    },
  };
}

// ── Teachers roster + KPIs ────────────────────────────────────────────────────

export const MOCK_COLLEAGUES: TeacherKpiRow[] = [
  { _id: "tch-014", displayId: "SSM-T-014", name: "Aarav Mehta", email: "aarav.mehta@example.com", mobile: "9876543210", status: "active", role: "owner", since: "2024-04-02T00:00:00.000Z", kpiPercent: 86, performance: 4.3 },
  { _id: "tch-018", displayId: "SSM-T-018", name: "Nirmal Rana", email: "nirmal.rana@example.com", mobile: "9876543211", status: "active", role: "staff", since: "2024-06-11T00:00:00.000Z", kpiPercent: 72, performance: 3.6 },
  { _id: "tch-019", displayId: "SSM-T-019", name: "Jyoti Gothwal", email: "jyoti.g@example.com", mobile: "9876543212", status: "active", role: "staff", since: "2024-08-21T00:00:00.000Z", kpiPercent: 64, performance: 3.2 },
  { _id: "tch-020", displayId: "SSM-T-020", name: "Kalpesh Rawal", email: "kalpesh.r@example.com", mobile: "9876543213", status: "active", role: "staff", since: "2025-01-09T00:00:00.000Z", kpiPercent: 48, performance: 2.4 },
  { _id: "tch-021", displayId: "SSM-T-021", name: "Vaibhav Shrivastav", email: "vaibhav.s@example.com", mobile: "9876543214", status: "active", role: "staff", since: "2025-03-14T00:00:00.000Z", kpiPercent: 31, performance: 1.6 },
];

export const MOCK_COLLEAGUES_RESPONSE: ApiResponse<TeacherKpiRow[]> = {
  success: true,
  message: "OK",
  data: MOCK_COLLEAGUES,
};

export function mockColleagueSchedule(teacherId: string, date: string | null): ApiResponse<ColleagueSchedule> {
  const t = MOCK_COLLEAGUES.find((c) => c._id === teacherId) ?? MOCK_COLLEAGUES[0];
  const rows = MOCK_BATCHES.map((b, i) => ({ ...b, launched: i % 3 === 0 }));
  return {
    success: true,
    message: "OK",
    data: {
      teacher: { _id: t._id, name: t.name, displayId: t.displayId, status: t.status },
      date,
      rows,
    },
  };
}

// ── Generic OK (logout, profile save) ────────────────────────────────────────

export const MOCK_OK: ApiResponse<null> = {
  success: true,
  message: "OK",
  data: null,
};
