// Single source of mock data for the institution admin panel (MOCK MODE).
// All money values are stored in PAISE (₹6,000 → 600000) and rendered through
// formatCurrency. All dates are in 2026. Every shape mirrors src/lib/types.ts,
// which itself is a TEMPORARY mirror of .claude/CONTRACTS.md.
//
// WHITE-LABEL: this file describes ONE institution ("Sunrise School of Music").
// No operator identity ever appears here.

import type {
  AdminSession,
  ApiResponse,
  AttendanceGrid,
  AuditLogItem,
  BatchRow,
  BrandingPublic,
  DayPatternItem,
  HolidayItem,
  Paginated,
  PaymentRow,
  RequestItem,
  StudentDetail,
  StudentRow,
  TeacherRow,
  TimeSlotItem,
  WebhookEventRow,
} from "./types";

// ── Envelope helpers ──────────────────────────────────────────────────────────

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginate<T>(items: T[], page = 1, limit = 50): Paginated<T> {
  return {
    items,
    pagination: { page, limit, total: items.length, pages: Math.max(1, Math.ceil(items.length / limit)) },
  };
}

// ── Branding (the ONLY identity this panel ever shows) ───────────────────────

export const MOCK_BRANDING: BrandingPublic = {
  slug: "sunrise-school-of-music",
  schoolName: "Sunrise School of Music",
  logoUrl: null, // null ⇒ initials logo
  primaryColor: "#0D9488", // deep teal — proves the branding override works
  tagline: "Where every note finds its home",
};

export const MOCK_SESSION: AdminSession = {
  user: {
    _id: "tch_01",
    name: "Priya Deshmukh",
    role: "institution_admin",
    institutionId: "inst_01",
    panelAccess: ["teacher", "admin"],
  },
  institution: MOCK_BRANDING,
};

// ── Instruments (institution's instrument list — used by selects) ────────────

export const MOCK_INSTRUMENTS: { _id: string; name: string }[] = [
  { _id: "ins_guitar", name: "Guitar" },
  { _id: "ins_piano", name: "Piano" },
  { _id: "ins_tabla", name: "Tabla" },
  { _id: "ins_vocal", name: "Vocal" },
  { _id: "ins_violin", name: "Violin" },
  { _id: "ins_flute", name: "Flute" },
  { _id: "ins_drums", name: "Drums" },
  { _id: "ins_sitar", name: "Sitar" },
];

// ── Suitable Days / Suitable Times ────────────────────────────────────────────

export const MOCK_DAY_PATTERNS: DayPatternItem[] = [
  { _id: "dp_mwf", days: ["mon", "wed", "fri"], label: "Mon · Wed · Fri", isActive: true },
  { _id: "dp_tts", days: ["tue", "thu", "sat"], label: "Tue · Thu · Sat", isActive: true },
  { _id: "dp_ss", days: ["sat", "sun"], label: "Sat · Sun", isActive: true },
  { _id: "dp_wkdy", days: ["mon", "tue", "wed", "thu", "fri"], label: "Weekdays", isActive: false },
];

export const MOCK_TIME_SLOTS: TimeSlotItem[] = [
  { _id: "ts_7am", startTime: "07:00", endTime: "08:00", label: "7:00-8:00 AM", isOnline: true },
  { _id: "ts_5pm", startTime: "17:00", endTime: "18:00", label: "5:00-6:00 PM", isOnline: true },
  { _id: "ts_6pm", startTime: "18:00", endTime: "19:00", label: "6:00-7:00 PM", isOnline: true },
  { _id: "ts_7pm", startTime: "19:00", endTime: "20:00", label: "7:00-8:00 PM", isOnline: false },
];

const DAY_INITIALS: Record<string, string> = {
  mon: "M", tue: "T", wed: "W", thu: "T", fri: "F", sat: "S", sun: "S",
};

/**
 * Client-side preview of the backend's `encodeBatchName` (P2-01 spec):
 * e.g. Guitar + 5:00-6:00 PM + Mon·Wed·Fri + online → "Guit 5:00-6:00 PM (MWF) ON"
 */
export function encodeBatchNamePreview(
  instrumentName: string | null,
  days: string[] | null,
  timeLabel: string | null,
  mode: "online" | "offline"
): string {
  const abbr = (instrumentName ?? "").replace(/[^A-Za-z]/g, "").slice(0, 4) || "????";
  const initials = (days ?? []).map((d) => DAY_INITIALS[d] ?? "").join("") || "—";
  return `${abbr} ${timeLabel ?? "—"} (${initials}) ${mode === "online" ? "ON" : "OF"}`;
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export const MOCK_TEACHERS: TeacherRow[] = [
  {
    _id: "tch_01", displayId: "TCH-001", name: "Priya Deshmukh",
    mobile: "9821044553", email: "priya.deshmukh@example.in",
    role: "owner", panelAccess: ["teacher", "admin"],
    activeBatches: 1, performance: 94, kpiPercent: 91, status: "active",
  },
  {
    _id: "tch_02", displayId: "TCH-002", name: "Rahul Verma",
    mobile: "9876543210", email: "rahul.verma@example.in",
    role: "staff", panelAccess: ["teacher"],
    activeBatches: 2, performance: 88, kpiPercent: 84, status: "active",
  },
  {
    _id: "tch_03", displayId: "TCH-003", name: "Neha Banerjee",
    mobile: "9830012398", email: "neha.banerjee@example.in",
    role: "staff", panelAccess: ["teacher"],
    activeBatches: 1, performance: 90, kpiPercent: 86, status: "active",
  },
  {
    _id: "tch_04", displayId: "TCH-004", name: "Suresh Iyer",
    mobile: "9445098712", email: "suresh.iyer@example.in",
    role: "staff", panelAccess: ["teacher"],
    activeBatches: 0, performance: 72, kpiPercent: 65, status: "inactive",
  },
  {
    _id: "tch_05", displayId: "TCH-005", name: "Kavita Rao",
    mobile: "9900887766", email: "kavita.rao@example.in",
    role: "staff", panelAccess: ["teacher"],
    activeBatches: 1, performance: 85, kpiPercent: 82, status: "active",
  },
];

// ── Batches ───────────────────────────────────────────────────────────────────

export const MOCK_BATCHES: BatchRow[] = [
  {
    _id: "bat_01", name: "Guit 5:00-6:00 PM (MWF) ON",
    instrument: { _id: "ins_guitar", name: "Guitar" },
    dayPattern: { _id: "dp_mwf", label: "Mon · Wed · Fri" },
    timeSlot: { _id: "ts_5pm", label: "5:00-6:00 PM" },
    teacher: { _id: "tch_02", name: "Rahul Verma" },
    studentCount: 4, status: "active",
  },
  {
    _id: "bat_02", name: "Pian 6:00-7:00 PM (TTS) ON",
    instrument: { _id: "ins_piano", name: "Piano" },
    dayPattern: { _id: "dp_tts", label: "Tue · Thu · Sat" },
    timeSlot: { _id: "ts_6pm", label: "6:00-7:00 PM" },
    teacher: { _id: "tch_03", name: "Neha Banerjee" },
    studentCount: 2, status: "active",
  },
  {
    _id: "bat_03", name: "Tabl 7:00-8:00 PM (TTS) OF",
    instrument: { _id: "ins_tabla", name: "Tabla" },
    dayPattern: { _id: "dp_tts", label: "Tue · Thu · Sat" },
    timeSlot: { _id: "ts_7pm", label: "7:00-8:00 PM" },
    teacher: { _id: "tch_05", name: "Kavita Rao" },
    studentCount: 1, status: "active",
  },
  {
    _id: "bat_04", name: "Voca 7:00-8:00 AM (MWF) ON",
    instrument: { _id: "ins_vocal", name: "Vocal" },
    dayPattern: { _id: "dp_mwf", label: "Mon · Wed · Fri" },
    timeSlot: { _id: "ts_7am", label: "7:00-8:00 AM" },
    teacher: { _id: "tch_01", name: "Priya Deshmukh" },
    studentCount: 3, status: "active",
  },
  {
    _id: "bat_05", name: "Viol 6:00-7:00 PM (SS) OF",
    instrument: { _id: "ins_violin", name: "Violin" },
    dayPattern: { _id: "dp_ss", label: "Sat · Sun" },
    timeSlot: { _id: "ts_6pm", label: "6:00-7:00 PM" },
    teacher: null, // ⇒ "Setting Phase"
    studentCount: 1, status: "setting",
  },
  {
    _id: "bat_06", name: "Flut 5:00-6:00 PM (TTS) ON",
    instrument: { _id: "ins_flute", name: "Flute" },
    dayPattern: { _id: "dp_tts", label: "Tue · Thu · Sat" },
    timeSlot: { _id: "ts_5pm", label: "5:00-6:00 PM" },
    teacher: { _id: "tch_04", name: "Suresh Iyer" },
    studentCount: 1, status: "inactive",
  },
  {
    _id: "bat_07", name: "Sita 7:00-8:00 PM (SS) OF",
    instrument: { _id: "ins_sitar", name: "Sitar" },
    dayPattern: { _id: "dp_ss", label: "Sat · Sun" },
    timeSlot: { _id: "ts_7pm", label: "7:00-8:00 PM" },
    teacher: { _id: "tch_05", name: "Kavita Rao" },
    studentCount: 1, status: "archived",
  },
];

// ── Students ──────────────────────────────────────────────────────────────────

type StudentSeed = StudentRow & {
  batchId: string | null;
  email: string | null;
  gender: string | null;
  mode: "online" | "offline";
  category: "regular" | "trial";
  validityStart: string | null;
  validityDays: number | null;
  paidClasses: number;
  upcomingClasses: number;
  paidAmount: number;
  upcomingAmount: number;
  createdAt: string;
};

const STUDENT_SEEDS: StudentSeed[] = [
  {
    _id: "stu_01", displayId: "STU-0001", name: "Aarav Sharma", mobile: "9810023411",
    instrument: "Guitar", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "5:00-6:00 PM" },
    joinStatus: "active", validityEnd: "2026-07-15",
    teacher: { _id: "tch_02", name: "Rahul Verma" }, batchId: "bat_01",
    email: "aarav.sharma@example.in", gender: "male", mode: "online", category: "regular",
    validityStart: "2026-05-16", validityDays: 60, paidClasses: 24, upcomingClasses: 9,
    paidAmount: 600000, upcomingAmount: 600000, createdAt: "2026-02-10",
  },
  {
    _id: "stu_02", displayId: "STU-0002", name: "Ananya Iyer", mobile: "9876509812",
    instrument: "Piano", classType: "One-to-One",
    schedule: { days: "Tue · Thu · Sat", time: "6:00-7:00 PM" },
    joinStatus: "active", validityEnd: "2026-08-02",
    teacher: { _id: "tch_03", name: "Neha Banerjee" }, batchId: "bat_02",
    email: "ananya.iyer@example.in", gender: "female", mode: "online", category: "regular",
    validityStart: "2026-06-03", validityDays: 60, paidClasses: 24, upcomingClasses: 21,
    paidAmount: 750000, upcomingAmount: 750000, createdAt: "2026-03-01",
  },
  {
    _id: "stu_03", displayId: "STU-0003", name: "Rohan Mehta", mobile: "9822098711",
    instrument: "Tabla", classType: "Group",
    schedule: { days: "Tue · Thu · Sat", time: "7:00-8:00 PM" },
    joinStatus: "trial", validityEnd: null,
    teacher: { _id: "tch_05", name: "Kavita Rao" }, batchId: "bat_03",
    email: null, gender: "male", mode: "offline", category: "trial",
    validityStart: null, validityDays: null, paidClasses: 0, upcomingClasses: 2,
    paidAmount: 0, upcomingAmount: 550000, createdAt: "2026-06-04",
  },
  {
    _id: "stu_04", displayId: "STU-0004", name: "Diya Patel", mobile: "9909812345",
    instrument: "Vocal", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "7:00-8:00 AM" },
    joinStatus: "active_soon", validityEnd: "2026-08-14",
    teacher: { _id: "tch_01", name: "Priya Deshmukh" }, batchId: "bat_04",
    email: "diya.patel@example.in", gender: "female", mode: "online", category: "regular",
    validityStart: "2026-06-15", validityDays: 60, paidClasses: 24, upcomingClasses: 24,
    paidAmount: 650000, upcomingAmount: 650000, createdAt: "2026-06-01",
  },
  {
    _id: "stu_05", displayId: "STU-0005", name: "Kabir Singh", mobile: "9871123409",
    instrument: "Guitar", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "5:00-6:00 PM" },
    joinStatus: "active", validityEnd: "2026-06-20",
    teacher: { _id: "tch_02", name: "Rahul Verma" }, batchId: "bat_01",
    email: "kabir.singh@example.in", gender: "male", mode: "online", category: "regular",
    validityStart: "2026-04-21", validityDays: 60, paidClasses: 24, upcomingClasses: 3,
    paidAmount: 600000, upcomingAmount: 600000, createdAt: "2026-01-18",
  },
  {
    _id: "stu_06", displayId: "STU-0006", name: "Ishita Nair", mobile: "9447098123",
    instrument: "Violin", classType: "One-to-One",
    schedule: { days: "Sat · Sun", time: "6:00-7:00 PM" },
    joinStatus: "active", validityEnd: "2026-08-07",
    teacher: null, batchId: "bat_05",
    email: "ishita.nair@example.in", gender: "female", mode: "offline", category: "regular",
    validityStart: "2026-06-08", validityDays: 60, paidClasses: 16, upcomingClasses: 15,
    paidAmount: 900000, upcomingAmount: 900000, createdAt: "2026-04-12",
  },
  {
    _id: "stu_07", displayId: "STU-0007", name: "Arjun Reddy", mobile: "9000123456",
    instrument: "Drums", classType: "Group",
    schedule: { days: null, time: null },
    joinStatus: "inactive", validityEnd: "2026-04-30",
    teacher: null, batchId: null,
    email: "arjun.reddy@example.in", gender: "male", mode: "offline", category: "regular",
    validityStart: "2026-03-01", validityDays: 60, paidClasses: 24, upcomingClasses: 0,
    paidAmount: 700000, upcomingAmount: 0, createdAt: "2025-12-05",
  },
  {
    _id: "stu_08", displayId: "STU-0008", name: "Meera Krishnan", mobile: "9445566778",
    instrument: "Vocal", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "7:00-8:00 AM" },
    joinStatus: "active", validityEnd: "2026-07-28",
    teacher: { _id: "tch_01", name: "Priya Deshmukh" }, batchId: "bat_04",
    email: "meera.krishnan@example.in", gender: "female", mode: "online", category: "regular",
    validityStart: "2026-05-29", validityDays: 60, paidClasses: 24, upcomingClasses: 18,
    paidAmount: 650000, upcomingAmount: 650000, createdAt: "2026-02-22",
  },
  {
    _id: "stu_09", displayId: "STU-0009", name: "Vivaan Gupta", mobile: "9811199887",
    instrument: "Piano", classType: "Group",
    schedule: { days: "Tue · Thu · Sat", time: "6:00-7:00 PM" },
    joinStatus: "trial", validityEnd: null,
    teacher: { _id: "tch_03", name: "Neha Banerjee" }, batchId: "bat_02",
    email: null, gender: "male", mode: "online", category: "trial",
    validityStart: null, validityDays: null, paidClasses: 0, upcomingClasses: 1,
    paidAmount: 0, upcomingAmount: 750000, createdAt: "2026-06-07",
  },
  {
    _id: "stu_10", displayId: "STU-0010", name: "Sara Khan", mobile: "9890011223",
    instrument: "Flute", classType: "One-to-One",
    schedule: { days: "Tue · Thu · Sat", time: "5:00-6:00 PM" },
    joinStatus: "active", validityEnd: "2026-07-05",
    teacher: { _id: "tch_04", name: "Suresh Iyer" }, batchId: "bat_06",
    email: "sara.khan@example.in", gender: "female", mode: "online", category: "regular",
    validityStart: "2026-05-06", validityDays: 60, paidClasses: 20, upcomingClasses: 7,
    paidAmount: 500000, upcomingAmount: 500000, createdAt: "2026-03-15",
  },
  {
    _id: "stu_11", displayId: "STU-0011", name: "Aditya Kulkarni", mobile: "9922334455",
    instrument: "Guitar", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "5:00-6:00 PM" },
    joinStatus: "active", validityEnd: "2026-07-11",
    teacher: { _id: "tch_02", name: "Rahul Verma" }, batchId: "bat_01",
    email: "aditya.kulkarni@example.in", gender: "male", mode: "offline", category: "regular",
    validityStart: "2026-05-12", validityDays: 60, paidClasses: 24, upcomingClasses: 11,
    paidAmount: 600000, upcomingAmount: 600000, createdAt: "2026-01-30",
  },
  {
    _id: "stu_12", displayId: "STU-0012", name: "Tanvi Joshi", mobile: "9833445566",
    instrument: "Sitar", classType: "One-to-One",
    schedule: { days: "Sat · Sun", time: "7:00-8:00 PM" },
    joinStatus: "active_soon", validityEnd: "2026-08-20",
    teacher: { _id: "tch_05", name: "Kavita Rao" }, batchId: "bat_07",
    email: "tanvi.joshi@example.in", gender: "female", mode: "offline", category: "regular",
    validityStart: "2026-06-21", validityDays: 60, paidClasses: 16, upcomingClasses: 16,
    paidAmount: 850000, upcomingAmount: 850000, createdAt: "2026-06-05",
  },
  {
    _id: "stu_13", displayId: "STU-0013", name: "Reyansh Chopra", mobile: "9810987654",
    instrument: "Guitar", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "5:00-6:00 PM" },
    joinStatus: "active", validityEnd: "2026-07-25",
    teacher: { _id: "tch_02", name: "Rahul Verma" }, batchId: "bat_01",
    email: "reyansh.chopra@example.in", gender: "male", mode: "online", category: "regular",
    validityStart: "2026-05-26", validityDays: 60, paidClasses: 24, upcomingClasses: 14,
    paidAmount: 600000, upcomingAmount: 600000, createdAt: "2026-04-02",
  },
  {
    _id: "stu_14", displayId: "STU-0014", name: "Lakshmi Pillai", mobile: "9447011255",
    instrument: "Vocal", classType: "Group",
    schedule: { days: "Mon · Wed · Fri", time: "7:00-8:00 AM" },
    joinStatus: "trial", validityEnd: null,
    teacher: { _id: "tch_01", name: "Priya Deshmukh" }, batchId: "bat_04",
    email: null, gender: "female", mode: "online", category: "trial",
    validityStart: null, validityDays: null, paidClasses: 0, upcomingClasses: 2,
    paidAmount: 0, upcomingAmount: 650000, createdAt: "2026-06-09",
  },
];

export const MOCK_STUDENTS: StudentRow[] = STUDENT_SEEDS.map(
  ({ batchId: _b, email: _e, gender: _g, mode: _m, category: _c, validityStart: _vs,
     validityDays: _vd, paidClasses: _pc, upcomingClasses: _uc, paidAmount: _pa,
     upcomingAmount: _ua, createdAt: _ca, ...row }) => row
);

export function mockStudentDetail(studentId: string): StudentDetail | null {
  const seed = STUDENT_SEEDS.find((s) => s._id === studentId);
  if (!seed) return null;
  const batch = seed.batchId ? MOCK_BATCHES.find((b) => b._id === seed.batchId) ?? null : null;
  const total = seed.paidClasses === 0 ? seed.upcomingClasses : seed.paidClasses - seed.upcomingClasses;
  const present = Math.max(0, Math.round(total * 0.85));
  return {
    _id: seed._id, displayId: seed.displayId, name: seed.name, mobile: seed.mobile,
    instrument: seed.instrument, classType: seed.classType, schedule: seed.schedule,
    joinStatus: seed.joinStatus, validityEnd: seed.validityEnd, teacher: seed.teacher,
    email: seed.email, gender: seed.gender, mode: seed.mode,
    sessionType: seed.mode === "online" ? "live" : "all", category: seed.category,
    validityStart: seed.validityStart, validityDays: seed.validityDays,
    paidClasses: seed.paidClasses, upcomingClasses: seed.upcomingClasses,
    paidAmount: seed.paidAmount, upcomingAmount: seed.upcomingAmount,
    attendanceSummary: { total: Math.max(total, 0), present, absent: Math.max(total - present, 0) },
    batch: batch ? { _id: batch._id, name: batch.name } : null,
    assignedVideoChapterId: null,
  };
}

/** Students assigned to a batch (drives the attendance grid rows). */
export function mockBatchStudents(batchId: string): StudentSeed[] {
  return STUDENT_SEEDS.filter((s) => s.batchId === batchId);
}

// ── Enrollment requests ───────────────────────────────────────────────────────

export const MOCK_REQUESTS: RequestItem[] = [
  {
    _id: "req_01", name: "Riya Malhotra", mobile: "9810455667", email: "riya.malhotra@example.in",
    preferredDays: { _id: "dp_mwf", label: "Mon · Wed · Fri" },
    preferredTime: { _id: "ts_5pm", label: "5:00-6:00 PM" },
    instrument: { _id: "ins_guitar", name: "Guitar" },
    status: "pending", paymentStatus: "unpaid", createdAt: "2026-06-08T10:15:00.000Z",
  },
  {
    _id: "req_02", name: "Aditi Rao", mobile: "9900112233", email: "aditi.rao@example.in",
    preferredDays: { _id: "dp_mwf", label: "Mon · Wed · Fri" },
    preferredTime: { _id: "ts_7am", label: "7:00-8:00 AM" },
    instrument: { _id: "ins_vocal", name: "Vocal" },
    status: "pending", paymentStatus: "paid", createdAt: "2026-06-09T08:40:00.000Z",
  },
  {
    _id: "req_03", name: "Karan Bajaj", mobile: "9822334411", email: null,
    preferredDays: { _id: "dp_tts", label: "Tue · Thu · Sat" },
    preferredTime: { _id: "ts_7pm", label: "7:00-8:00 PM" },
    instrument: { _id: "ins_tabla", name: "Tabla" },
    status: "pending", paymentStatus: "unpaid", createdAt: "2026-06-05T16:05:00.000Z",
  },
  {
    _id: "req_04", name: "Nikhil Menon", mobile: "9447788990", email: "nikhil.menon@example.in",
    preferredDays: { _id: "dp_tts", label: "Tue · Thu · Sat" },
    preferredTime: { _id: "ts_6pm", label: "6:00-7:00 PM" },
    instrument: { _id: "ins_piano", name: "Piano" },
    status: "approved", paymentStatus: "paid", createdAt: "2026-05-28T11:25:00.000Z",
  },
  {
    _id: "req_05", name: "Pooja Hegde", mobile: "9876001122", email: "pooja.hegde@example.in",
    preferredDays: { _id: "dp_ss", label: "Sat · Sun" },
    preferredTime: { _id: "ts_6pm", label: "6:00-7:00 PM" },
    instrument: { _id: "ins_violin", name: "Violin" },
    status: "rejected", paymentStatus: "unpaid", createdAt: "2026-05-20T09:00:00.000Z",
  },
  {
    _id: "req_06", name: "Farhan Sheikh", mobile: "9833221100", email: null,
    preferredDays: null, preferredTime: null,
    instrument: { _id: "ins_flute", name: "Flute" },
    status: "pending", paymentStatus: "unpaid", createdAt: "2026-06-10T07:55:00.000Z",
  },
];

// ── Payments ──────────────────────────────────────────────────────────────────
// amounts in PAISE: 600000 = ₹6,000

export const MOCK_PAYMENTS: PaymentRow[] = [
  { _id: "pay_01", student: { _id: "stu_01", name: "Aarav Sharma" }, type: "fee",
    period: "Jun 2026", amount: 600000, status: "paid", method: "razorpay", paidAt: "2026-06-03T09:12:00.000Z" },
  { _id: "pay_02", student: { _id: "stu_02", name: "Ananya Iyer" }, type: "fee",
    period: "Jun 2026", amount: 750000, status: "paid", method: "manual", paidAt: "2026-06-05T12:30:00.000Z" },
  { _id: "pay_03", student: { _id: "stu_05", name: "Kabir Singh" }, type: "fee",
    period: "May 2026", amount: 600000, status: "overdue", method: "manual", paidAt: null },
  { _id: "pay_04", student: { _id: "stu_08", name: "Meera Krishnan" }, type: "admission",
    period: null, amount: 150000, status: "paid", method: "cash", paidAt: "2026-06-01T10:00:00.000Z" },
  { _id: "pay_05", student: { _id: "stu_06", name: "Ishita Nair" }, type: "fee",
    period: "Jun 2026", amount: 900000, status: "paid", method: "razorpay", paidAt: "2026-06-07T18:45:00.000Z" },
  { _id: "pay_06", student: { _id: "stu_10", name: "Sara Khan" }, type: "fee",
    period: "Jun 2026", amount: 500000, status: "partial", method: "manual", paidAt: "2026-06-08T15:20:00.000Z" },
  { _id: "pay_07", student: { _id: "stu_11", name: "Aditya Kulkarni" }, type: "fee",
    period: "May 2026", amount: 600000, status: "paid", method: "razorpay", paidAt: "2026-05-12T08:05:00.000Z" },
  { _id: "pay_08", student: { _id: "stu_03", name: "Rohan Mehta" }, type: "fee",
    period: "Jun 2026", amount: 0, status: "free", method: "manual", paidAt: null },
  { _id: "pay_09", student: { _id: "stu_12", name: "Tanvi Joshi" }, type: "admission",
    period: null, amount: 150000, status: "paid", method: "manual", paidAt: "2026-06-09T11:10:00.000Z" },
  { _id: "pay_10", student: { _id: "stu_09", name: "Vivaan Gupta" }, type: "fee",
    period: "Jun 2026", amount: 750000, status: "overdue", method: "razorpay", paidAt: null },
];

// ── Razorpay webhook reconciliation feed ──────────────────────────────────────
// paymentId !== null ⇒ matched to a Payment record; null ⇒ needs manual match.

export const MOCK_WEBHOOK_EVENTS: WebhookEventRow[] = [
  { _id: "wh_01", eventType: "payment.captured", paymentId: "pay_01", amount: 600000,
    contact: "+919810023411", payerName: "Aarav Sharma", status: "captured", receivedAt: "2026-06-03T09:12:21.000Z" },
  { _id: "wh_02", eventType: "payment.captured", paymentId: "pay_05", amount: 900000,
    contact: "+919447098123", payerName: "Ishita Nair", status: "captured", receivedAt: "2026-06-07T18:45:42.000Z" },
  { _id: "wh_03", eventType: "payment.captured", paymentId: null, amount: 650000,
    contact: "+919909812345", payerName: "Diya Patel", status: "captured", receivedAt: "2026-06-09T19:02:11.000Z" },
  { _id: "wh_04", eventType: "payment.failed", paymentId: null, amount: 750000,
    contact: "+919811199887", payerName: "Vivaan Gupta", status: "failed", receivedAt: "2026-06-08T20:14:09.000Z" },
  { _id: "wh_05", eventType: "payment.captured", paymentId: null, amount: 550000,
    contact: "+919822098711", payerName: null, status: "captured", receivedAt: "2026-06-10T06:38:54.000Z" },
  { _id: "wh_06", eventType: "payment.captured", paymentId: "pay_07", amount: 600000,
    contact: "+919922334455", payerName: "Aditya Kulkarni", status: "captured", receivedAt: "2026-05-12T08:05:33.000Z" },
];

// ── Holidays ──────────────────────────────────────────────────────────────────

export const MOCK_HOLIDAYS: HolidayItem[] = [
  { _id: "hol_01", batch: { _id: "bat_01", name: "Guit 5:00-6:00 PM (MWF) ON" },
    date: "2026-06-15", studentCategory: "regular", reason: "Studio maintenance" },
  { _id: "hol_02", batch: { _id: "bat_04", name: "Voca 7:00-8:00 AM (MWF) ON" },
    date: "2026-06-12", studentCategory: "trial", reason: "Teacher workshop" },
  { _id: "hol_03", batch: { _id: "bat_02", name: "Pian 6:00-7:00 PM (TTS) ON" },
    date: "2026-07-29", studentCategory: "regular", reason: "Guru Purnima" },
];

// ── Per-student activity feed (AuditLog entries, entityId = student) ─────────

export function mockStudentActivity(studentId: string): AuditLogItem[] {
  const seed = STUDENT_SEEDS.find((s) => s._id === studentId);
  if (!seed) return [];
  const inst = { _id: "inst_01", name: MOCK_BRANDING.schoolName };
  const label = `Student: ${seed.name}`;
  const base = {
    institution: inst, impersonatedBy: null, entityType: "Student",
    entityId: seed._id, entityLabel: label, before: null, after: null, ip: null,
  };
  const entries: AuditLogItem[] = [
    {
      ...base, _id: `aud_${studentId}_1`, actorRole: "institution_admin",
      actorName: "Priya Deshmukh", action: "CREATE_STUDENT",
      changes: [], createdAt: `${seed.createdAt}T09:30:00.000Z`,
    },
  ];
  if (seed.paidAmount > 0) {
    entries.push({
      ...base, _id: `aud_${studentId}_2`, actorRole: "institution_admin",
      actorName: "Priya Deshmukh", action: "UPDATE_PAID_AMOUNT",
      changes: [{ field: "paidAmount", from: 0, to: seed.paidAmount }],
      createdAt: seed.validityStart ? `${seed.validityStart}T10:05:00.000Z` : `${seed.createdAt}T12:00:00.000Z`,
    });
  }
  if (seed.joinStatus === "active" || seed.joinStatus === "inactive") {
    entries.push({
      ...base, _id: `aud_${studentId}_3`, actorRole: "system", actorName: "System",
      action: "UPDATE_JOIN_STATUS",
      changes: [{ field: "joinStatus", from: "active_soon", to: "active" }],
      createdAt: seed.validityStart ? `${seed.validityStart}T00:10:00.000Z` : "2026-06-01T00:10:00.000Z",
    });
  }
  if (seed.joinStatus === "inactive") {
    entries.push({
      ...base, _id: `aud_${studentId}_4`, actorRole: "system", actorName: "System",
      action: "UPDATE_JOIN_STATUS",
      changes: [{ field: "joinStatus", from: "active", to: "inactive" }],
      createdAt: seed.validityEnd ? `${seed.validityEnd}T00:10:00.000Z` : "2026-05-01T00:10:00.000Z",
    });
  }
  if (seed.batchId) {
    const batch = MOCK_BATCHES.find((b) => b._id === seed.batchId);
    entries.push({
      ...base, _id: `aud_${studentId}_5`, actorRole: "institution_admin",
      actorName: "Priya Deshmukh", action: "ASSIGN_BATCH",
      changes: [{ field: "batch", from: null, to: batch?.name ?? seed.batchId }],
      createdAt: `${seed.createdAt}T09:45:00.000Z`,
    });
  }
  if (seed.teacher) {
    entries.push({
      ...base, _id: `aud_${studentId}_6`, actorRole: "teacher",
      actorName: seed.teacher.name, action: "MARK_ATTENDANCE",
      changes: [{ field: "attendance", from: "unmarked", to: "present" }],
      createdAt: "2026-06-08T17:58:00.000Z",
    });
  }
  return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ── Attendance grid generator ─────────────────────────────────────────────────

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Deterministic mock for GET /attendance?batchId=&from=&to= — one calendar month.
 * Columns are only the batch's class days inside the month; past cells are mostly
 * present with scattered absents/credits; future cells are unmarked; declared
 * holidays override everything.
 */
export function mockAttendanceGrid(batchId: string, year: number, month: number): AttendanceGrid {
  const batch = MOCK_BATCHES.find((b) => b._id === batchId) ?? MOCK_BATCHES[0];
  const pattern = MOCK_DAY_PATTERNS.find((p) => p._id === batch.dayPattern?._id);
  const classDays = new Set(pattern?.days ?? []);
  const holidayDates = new Set(
    MOCK_HOLIDAYS.filter((h) => h.batch._id === batch._id).map((h) => h.date)
  );
  const today = new Date();

  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    if (classDays.has(WEEKDAY_KEYS[dt.getDay()])) {
      dates.push(`${year}-${`${month + 1}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`);
    }
  }

  const rows = mockBatchStudents(batch._id).map((s) => {
    const marks: AttendanceGrid["rows"][number]["marks"] = {};
    for (const date of dates) {
      if (holidayDates.has(date)) {
        marks[date] = "holiday";
        continue;
      }
      if (new Date(`${date}T23:59:59`) > today) {
        marks[date] = "unmarked";
        continue;
      }
      const roll = hashCode(`${s._id}:${date}`) % 10;
      marks[date] = roll < 7 ? "present" : roll < 9 ? "absent" : "credited";
    }
    return { student: { _id: s._id, name: s.name, displayId: s.displayId }, marks };
  });

  return { batch: { _id: batch._id, name: batch.name }, dates, rows };
}
