// ─────────────────────────────────────────────────────────────────────────────
// SINGLE HOME for ALL operator-panel mock data.
// Every page calls `mockable(realApiCall, mock…)` with a mock built here, so
// wiring the real API later is a one-file diff per page (delete the mock arg).
// Amounts are in PAISE (formatCurrency renders ₹). Dates are 2026.
// Shapes mirror .claude/CONTRACTS.md exactly — see src/lib/types.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ActorRole,
  ApiResponse,
  Paginated,
  AuditLogItem,
  BrandingPublic,
  InstitutionDetail,
  InstitutionListItem,
  OperatorDashboardData,
  OperatorLoginChallenge,
  OperatorPaymentRow,
  OperatorProfile,
  OperatorSettingsData,
  OperatorStudentRow,
  OperatorTeacherRow,
  RentInvoiceItem,
  SlugChangeRequestRow,
} from "./types";

// ── Envelope helpers ──────────────────────────────────────────────────────────

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginate<T>(items: T[], page = 1, limit = 10): Paginated<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), pages);
  return {
    items: items.slice((safePage - 1) * limit, safePage * limit),
    pagination: { page: safePage, limit, total, pages },
  };
}

const contains = (haystack: string | null | undefined, q: string) =>
  (haystack ?? "").toLowerCase().includes(q.toLowerCase());

// ── Operator (superadmin) ─────────────────────────────────────────────────────

export const MOCK_OPERATOR: OperatorProfile = {
  _id: "op_000000000000000000000001",
  name: "Aditya Khanna",
  email: "aditya@operator.example",
  role: "superadmin",
};

export const mockLoginChallenge = (): ApiResponse<OperatorLoginChallenge> =>
  ok(
    { twoFactorRequired: true, challengeToken: "mock-challenge-token-7f3a" },
    "Enter the 6-digit code from your authenticator app"
  );

export const mockVerify2fa = (): ApiResponse<{ operator: OperatorProfile }> =>
  ok({ operator: MOCK_OPERATOR }, "Welcome back");

export const mockMe = (): ApiResponse<{ operator: OperatorProfile }> =>
  ok({ operator: MOCK_OPERATOR });

export const mockLogout = (): ApiResponse<null> => ok(null, "Signed out");

// ── Institutions ──────────────────────────────────────────────────────────────

const branding = (
  slug: string,
  schoolName: string,
  primaryColor: string,
  tagline: string | null
): BrandingPublic => ({ slug, schoolName, logoUrl: null, primaryColor, tagline });

export const MOCK_INSTITUTIONS: InstitutionListItem[] = [
  {
    _id: "inst_01",
    name: "Swar Sadhana Music Academy",
    slug: "swar-sadhana-music-academy",
    mode: "autonomous",
    status: "active",
    ownerTeacher: { _id: "t_01", name: "Pandit Ramesh Iyer", mobile: "9876543210" },
    studentCount: 64,
    teacherCount: 4,
    rentStatus: "paid",
    branding: branding("swar-sadhana-music-academy", "Swar Sadhana Music Academy", "#0d9488", "Where every note becomes prayer"),
    createdAt: "2026-01-12T09:30:00.000Z",
  },
  {
    _id: "inst_02",
    name: "Taal Tarang Tabla Academy",
    slug: "taal-tarang-tabla-academy",
    mode: "managed",
    status: "active",
    ownerTeacher: { _id: "t_02", name: "Vikram Joshi", mobile: "9812345678" },
    studentCount: 38,
    teacherCount: 2,
    rentStatus: "na",
    branding: branding("taal-tarang-tabla-academy", "Taal Tarang Tabla Academy", "#b45309", "Rhythm runs in our blood"),
    createdAt: "2026-01-28T11:00:00.000Z",
  },
  {
    _id: "inst_03",
    name: "Sangeet Niketan Delhi",
    slug: "sangeet-niketan-delhi",
    mode: "autonomous",
    status: "active",
    ownerTeacher: { _id: "t_03", name: "Anjali Deshmukh", mobile: "9988776655" },
    studentCount: 92,
    teacherCount: 6,
    rentStatus: "overdue",
    branding: branding("sangeet-niketan-delhi", "Sangeet Niketan Delhi", "#7c3aed", "Classical music, modern teaching"),
    createdAt: "2026-02-03T08:15:00.000Z",
  },
  {
    _id: "inst_04",
    name: "Melody Makers Guitar School",
    slug: "melody-makers-guitar-school",
    mode: "managed",
    status: "active",
    ownerTeacher: { _id: "t_04", name: "Suresh Menon", mobile: "9090909090" },
    studentCount: 47,
    teacherCount: 3,
    rentStatus: "na",
    branding: branding("melody-makers-guitar-school", "Melody Makers Guitar School", "#2563eb", "Strum your story"),
    createdAt: "2026-02-19T14:45:00.000Z",
  },
  {
    _id: "inst_05",
    name: "Sur Sangam Vocal Academy",
    slug: "sur-sangam-vocal-academy",
    mode: "autonomous",
    status: "suspended",
    ownerTeacher: { _id: "t_05", name: "Kavita Nair", mobile: "9871203456" },
    studentCount: 25,
    teacherCount: 2,
    rentStatus: "overdue",
    branding: branding("sur-sangam-vocal-academy", "Sur Sangam Vocal Academy", "#dc2626", "Find your voice"),
    createdAt: "2026-03-07T10:20:00.000Z",
  },
  {
    _id: "inst_06",
    name: "Riyaaz Piano Studio",
    slug: "riyaaz-piano-studio",
    mode: "autonomous",
    status: "active",
    ownerTeacher: { _id: "t_06", name: "Imran Shaikh", mobile: "9765432109" },
    studentCount: 31,
    teacherCount: 2,
    rentStatus: "pending",
    branding: branding("riyaaz-piano-studio", "Riyaaz Piano Studio", "#0891b2", "88 keys, infinite riyaaz"),
    createdAt: "2026-03-22T16:05:00.000Z",
  },
  {
    _id: "inst_07",
    name: "Naad Flute Academy",
    slug: "naad-flute-academy",
    mode: "managed",
    status: "pending",
    ownerTeacher: { _id: "t_07", name: "Deepak Rawat", mobile: "9654321870" },
    studentCount: 0,
    teacherCount: 1,
    rentStatus: "na",
    branding: branding("naad-flute-academy", "Naad Flute Academy", "#16a34a", "Breath becomes music"),
    createdAt: "2026-05-29T12:00:00.000Z",
  },
  {
    _id: "inst_08",
    name: "Dhwani School of Music",
    slug: "dhwani-school-of-music",
    mode: "managed",
    status: "terminated",
    ownerTeacher: { _id: "t_08", name: "Manoj Tiwari", mobile: "9543216780" },
    studentCount: 12,
    teacherCount: 1,
    rentStatus: "na",
    branding: branding("dhwani-school-of-music", "Dhwani School of Music", "#475569", null),
    createdAt: "2025-11-15T09:00:00.000Z",
  },
];

export function mockInstitutionList(params: {
  page?: number;
  limit?: number;
  search?: string;
  mode?: string;
  status?: string;
}): ApiResponse<Paginated<InstitutionListItem>> {
  let rows = MOCK_INSTITUTIONS;
  if (params.search)
    rows = rows.filter(
      (r) => contains(r.name, params.search!) || contains(r.slug, params.search!)
    );
  if (params.mode && params.mode !== "all") rows = rows.filter((r) => r.mode === params.mode);
  if (params.status && params.status !== "all")
    rows = rows.filter((r) => r.status === params.status);
  return ok(paginate(rows, params.page, params.limit ?? 10));
}

const INSTITUTION_DETAIL_EXTRAS: Record<
  string,
  { contactEmail: string; rent: InstitutionDetail["rent"]; counts: InstitutionDetail["counts"] }
> = {
  inst_01: {
    contactEmail: "ramesh@swarsadhana.example",
    rent: { amount: 2500000, billingCycle: "monthly", nextDueDate: "2026-07-01T00:00:00.000Z" },
    counts: { batches: 9, activeStudents: 51, trialStudents: 8 },
  },
  inst_02: {
    contactEmail: "vikram@taaltarang.example",
    rent: null,
    counts: { batches: 5, activeStudents: 30, trialStudents: 5 },
  },
  inst_03: {
    contactEmail: "anjali@sangeetniketan.example",
    rent: { amount: 4000000, billingCycle: "monthly", nextDueDate: "2026-06-01T00:00:00.000Z" },
    counts: { batches: 14, activeStudents: 78, trialStudents: 9 },
  },
  inst_04: {
    contactEmail: "suresh@melodymakers.example",
    rent: null,
    counts: { batches: 7, activeStudents: 39, trialStudents: 6 },
  },
  inst_05: {
    contactEmail: "kavita@sursangam.example",
    rent: { amount: 1800000, billingCycle: "monthly", nextDueDate: "2026-05-01T00:00:00.000Z" },
    counts: { batches: 4, activeStudents: 21, trialStudents: 2 },
  },
  inst_06: {
    contactEmail: "imran@riyaazpiano.example",
    rent: { amount: 2200000, billingCycle: "monthly", nextDueDate: "2026-07-05T00:00:00.000Z" },
    counts: { batches: 5, activeStudents: 26, trialStudents: 4 },
  },
  inst_07: {
    contactEmail: "deepak@naadflute.example",
    rent: null,
    counts: { batches: 0, activeStudents: 0, trialStudents: 0 },
  },
  inst_08: {
    contactEmail: "manoj@dhwani.example",
    rent: null,
    counts: { batches: 2, activeStudents: 0, trialStudents: 0 },
  },
};

export function mockInstitutionDetail(id: string): ApiResponse<InstitutionDetail> {
  const base = MOCK_INSTITUTIONS.find((i) => i._id === id) ?? MOCK_INSTITUTIONS[0];
  const extras = INSTITUTION_DETAIL_EXTRAS[base._id] ?? {
    contactEmail: "owner@school.example",
    rent: null,
    counts: { batches: 0, activeStudents: 0, trialStudents: 0 },
  };
  return ok({ ...base, ...extras });
}

export const mockInstitutionAction = (
  inst: InstitutionListItem
): ApiResponse<{ institution: InstitutionListItem }> =>
  ok({ institution: inst }, "Done");

export const mockImpersonate = (): ApiResponse<{ url: string; expiresInSec: number }> =>
  ok({ url: "#impersonation-mock", expiresInSec: 300 }, "Impersonation token issued (mock)");

// ── Students (cross-institution) ──────────────────────────────────────────────

const instTag = (id: string) => {
  const i = MOCK_INSTITUTIONS.find((x) => x._id === id)!;
  return { _id: i._id, name: i.name, slug: i.slug };
};

type StudentSeed = [
  name: string,
  mobile: string,
  instId: string,
  teacher: { _id: string; name: string } | null,
  instrument: string | null,
  joinStatus: OperatorStudentRow["joinStatus"],
  paidAmount: number,
  upcomingAmount: number,
  validityEnd: string | null,
];

const STUDENT_SEEDS: StudentSeed[] = [
  ["Aarav Sharma", "9876501234", "inst_01", { _id: "t_01", name: "Pandit Ramesh Iyer" }, "Sitar", "active", 600000, 600000, "2026-07-18T00:00:00.000Z"],
  ["Ananya Iyer", "9876512345", "inst_01", { _id: "t_09", name: "Shruti Kale" }, "Vocal", "active", 450000, 450000, "2026-07-02T00:00:00.000Z"],
  ["Vihaan Gupta", "9876523456", "inst_02", { _id: "t_02", name: "Vikram Joshi" }, "Tabla", "trial", 0, 350000, null],
  ["Diya Patel", "9876534567", "inst_03", { _id: "t_03", name: "Anjali Deshmukh" }, "Vocal", "active", 500000, 500000, "2026-06-25T00:00:00.000Z"],
  ["Arjun Nair", "9876545678", "inst_04", { _id: "t_04", name: "Suresh Menon" }, "Guitar", "active", 400000, 400000, "2026-08-01T00:00:00.000Z"],
  ["Ishita Reddy", "9876556789", "inst_03", { _id: "t_10", name: "Neha Bhatt" }, "Veena", "active_soon", 550000, 0, "2026-08-10T00:00:00.000Z"],
  ["Kabir Singh", "9876567890", "inst_06", { _id: "t_06", name: "Imran Shaikh" }, "Piano", "active", 700000, 700000, "2026-07-22T00:00:00.000Z"],
  ["Meera Krishnan", "9876578901", "inst_01", { _id: "t_01", name: "Pandit Ramesh Iyer" }, "Sitar", "inactive", 600000, 0, "2026-04-30T00:00:00.000Z"],
  ["Rohan Verma", "9876589012", "inst_02", { _id: "t_02", name: "Vikram Joshi" }, "Tabla", "active", 350000, 350000, "2026-07-09T00:00:00.000Z"],
  ["Sneha Joshi", "9876590123", "inst_05", { _id: "t_05", name: "Kavita Nair" }, "Vocal", "inactive", 300000, 0, "2026-03-31T00:00:00.000Z"],
  ["Aditi Rao", "9765401234", "inst_03", { _id: "t_03", name: "Anjali Deshmukh" }, "Harmonium", "active", 480000, 480000, "2026-06-28T00:00:00.000Z"],
  ["Dev Malhotra", "9765412345", "inst_04", { _id: "t_11", name: "Rajiv Pillai" }, "Guitar", "trial", 0, 400000, null],
  ["Tanvi Kulkarni", "9765423456", "inst_06", { _id: "t_06", name: "Imran Shaikh" }, "Piano", "active", 700000, 700000, "2026-08-15T00:00:00.000Z"],
  ["Yash Agarwal", "9765434567", "inst_01", { _id: "t_12", name: "Asha Gokhale" }, "Tabla", "active", 380000, 380000, "2026-07-30T00:00:00.000Z"],
  ["Priya Menon", "9765445678", "inst_03", { _id: "t_03", name: "Anjali Deshmukh" }, "Vocal", "active", 500000, 500000, "2026-07-12T00:00:00.000Z"],
  ["Kunal Bose", "9765456789", "inst_02", { _id: "t_02", name: "Vikram Joshi" }, "Tabla", "active_soon", 350000, 0, "2026-08-20T00:00:00.000Z"],
  ["Riya Chatterjee", "9765467890", "inst_04", { _id: "t_04", name: "Suresh Menon" }, "Ukulele", "active", 320000, 320000, "2026-06-20T00:00:00.000Z"],
  ["Aryan Khanna", "9765478901", "inst_06", { _id: "t_06", name: "Imran Shaikh" }, "Keyboard", "trial", 0, 600000, null],
  ["Nandini Desai", "9765489012", "inst_01", { _id: "t_09", name: "Shruti Kale" }, "Vocal", "active", 450000, 450000, "2026-08-05T00:00:00.000Z"],
  ["Shaurya Kapoor", "9765490123", "inst_03", { _id: "t_13", name: "Harpreet Gill" }, "Sitar", "active", 620000, 620000, "2026-07-25T00:00:00.000Z"],
  ["Pooja Hegde", "9654301234", "inst_05", { _id: "t_05", name: "Kavita Nair" }, "Vocal", "inactive", 300000, 0, "2026-04-15T00:00:00.000Z"],
  ["Harsh Vora", "9654312345", "inst_04", { _id: "t_04", name: "Suresh Menon" }, "Guitar", "active", 400000, 400000, "2026-09-01T00:00:00.000Z"],
  ["Lakshmi Pillai", "9654323456", "inst_03", { _id: "t_03", name: "Anjali Deshmukh" }, "Veena", "active", 580000, 580000, "2026-07-08T00:00:00.000Z"],
  ["Nikhil Saxena", "9654334567", "inst_02", null, "Tabla", "trial", 0, 350000, null],
  ["Avni Trivedi", "9654345678", "inst_01", { _id: "t_01", name: "Pandit Ramesh Iyer" }, "Sitar", "active", 600000, 600000, "2026-08-22T00:00:00.000Z"],
  ["Manav Shah", "9654356789", "inst_06", { _id: "t_14", name: "Zoya Sayed" }, "Piano", "active_soon", 700000, 0, "2026-09-10T00:00:00.000Z"],
  ["Sanya Bhatia", "9654367890", "inst_03", { _id: "t_10", name: "Neha Bhatt" }, "Vocal", "active", 500000, 500000, "2026-06-30T00:00:00.000Z"],
  ["Pranav Kulkarni", "9654378901", "inst_04", { _id: "t_11", name: "Rajiv Pillai" }, "Guitar", "active", 400000, 400000, "2026-07-15T00:00:00.000Z"],
  ["Ritika Ghosh", "9654389012", "inst_01", { _id: "t_12", name: "Asha Gokhale" }, "Tabla", "active", 380000, 380000, "2026-08-18T00:00:00.000Z"],
  ["Om Prakash Yadav", "9654390123", "inst_02", { _id: "t_02", name: "Vikram Joshi" }, "Tabla", "active", 350000, 350000, "2026-07-28T00:00:00.000Z"],
];

export const MOCK_STUDENTS: OperatorStudentRow[] = STUDENT_SEEDS.map(
  ([name, mobile, instId, teacher, instrument, joinStatus, paidAmount, upcomingAmount, validityEnd], i) => ({
    _id: `stu_${String(i + 1).padStart(2, "0")}`,
    displayId: `STU-${String(101 + i)}`,
    name,
    mobile,
    email: i % 3 === 0 ? `${name.split(" ")[0].toLowerCase()}@gmail.example` : null,
    institution: instTag(instId),
    teacher,
    batch: teacher
      ? { _id: `batch_${instId}_${i % 4}`, name: `${(instrument ?? "MUS").slice(0, 3).toUpperCase()}-MWF-${5 + (i % 3)}PM` }
      : null,
    instrument,
    joinStatus,
    paidAmount,
    upcomingAmount,
    validityEnd,
    createdAt: `2026-0${1 + (i % 5)}-${String(2 + (i % 26)).padStart(2, "0")}T10:00:00.000Z`,
  })
);

export function mockStudentList(params: {
  page?: number;
  limit?: number;
  search?: string;
  institutionId?: string;
  joinStatus?: string;
}): ApiResponse<Paginated<OperatorStudentRow>> {
  let rows = MOCK_STUDENTS;
  if (params.search)
    rows = rows.filter(
      (r) =>
        contains(r.name, params.search!) ||
        contains(r.mobile, params.search!) ||
        contains(r.displayId, params.search!)
    );
  if (params.institutionId)
    rows = rows.filter((r) => r.institution._id === params.institutionId);
  if (params.joinStatus && params.joinStatus !== "all")
    rows = rows.filter((r) => r.joinStatus === params.joinStatus);
  return ok(paginate(rows, params.page, params.limit ?? 10));
}

// ── Teachers (cross-institution) ──────────────────────────────────────────────

type TeacherSeed = [
  id: string,
  name: string,
  mobile: string,
  email: string,
  instId: string,
  role: "owner" | "staff",
  employmentType: "salary" | "rent",
  amount: number | null,
  activeBatches: number,
  status: "active" | "inactive",
];

const TEACHER_SEEDS: TeacherSeed[] = [
  ["t_01", "Pandit Ramesh Iyer", "9876543210", "ramesh@swarsadhana.example", "inst_01", "owner", "rent", 2500000, 4, "active"],
  ["t_09", "Shruti Kale", "9822001122", "shruti@swarsadhana.example", "inst_01", "staff", "salary", 3500000, 3, "active"],
  ["t_12", "Asha Gokhale", "9822113344", "asha@swarsadhana.example", "inst_01", "staff", "salary", 3200000, 2, "active"],
  ["t_02", "Vikram Joshi", "9812345678", "vikram@taaltarang.example", "inst_02", "owner", "salary", 4000000, 3, "active"],
  ["t_15", "Bhavesh Patil", "9812456789", "bhavesh@taaltarang.example", "inst_02", "staff", "salary", 2800000, 2, "active"],
  ["t_03", "Anjali Deshmukh", "9988776655", "anjali@sangeetniketan.example", "inst_03", "owner", "rent", 4000000, 5, "active"],
  ["t_10", "Neha Bhatt", "9988112233", "neha@sangeetniketan.example", "inst_03", "staff", "salary", 3000000, 4, "active"],
  ["t_13", "Harpreet Gill", "9988224455", "harpreet@sangeetniketan.example", "inst_03", "staff", "salary", 3300000, 3, "active"],
  ["t_04", "Suresh Menon", "9090909090", "suresh@melodymakers.example", "inst_04", "owner", "salary", 4500000, 4, "active"],
  ["t_11", "Rajiv Pillai", "9090801122", "rajiv@melodymakers.example", "inst_04", "staff", "salary", 2600000, 3, "active"],
  ["t_05", "Kavita Nair", "9871203456", "kavita@sursangam.example", "inst_05", "owner", "rent", 1800000, 2, "inactive"],
  ["t_06", "Imran Shaikh", "9765432109", "imran@riyaazpiano.example", "inst_06", "owner", "rent", 2200000, 3, "active"],
  ["t_14", "Zoya Sayed", "9765512233", "zoya@riyaazpiano.example", "inst_06", "staff", "salary", 2400000, 2, "active"],
  ["t_07", "Deepak Rawat", "9654321870", "deepak@naadflute.example", "inst_07", "owner", "salary", 3000000, 0, "active"],
];

export const MOCK_TEACHERS: OperatorTeacherRow[] = TEACHER_SEEDS.map(
  ([_id, name, mobile, email, instId, role, employmentType, amount, activeBatches, status], i) => ({
    _id,
    displayId: `TCH-${String(11 + i)}`,
    name,
    mobile,
    email,
    institution: instTag(instId),
    role,
    employmentType,
    amount,
    activeBatches,
    status,
    createdAt: `2026-0${1 + (i % 4)}-1${i % 9}T09:00:00.000Z`,
  })
);

/** Owner-of-institution panelAccess is derived from institution mode (PBAC). */
export function teacherPanelAccess(row: OperatorTeacherRow): ("teacher" | "admin")[] {
  if (row.role === "owner" && row.employmentType === "rent") return ["teacher", "admin"];
  return ["teacher"];
}

export function mockTeacherList(params: {
  page?: number;
  limit?: number;
  search?: string;
  institutionId?: string;
  employmentType?: string;
}): ApiResponse<Paginated<OperatorTeacherRow>> {
  let rows = MOCK_TEACHERS;
  if (params.search)
    rows = rows.filter(
      (r) => contains(r.name, params.search!) || contains(r.mobile, params.search!)
    );
  if (params.institutionId)
    rows = rows.filter((r) => r.institution._id === params.institutionId);
  if (params.employmentType && params.employmentType !== "all")
    rows = rows.filter((r) => r.employmentType === params.employmentType);
  return ok(paginate(rows, params.page, params.limit ?? 10));
}

// ── Entity edits (operator god-mode PATCH) ────────────────────────────────────
// CONTRACT GAP: flag for Dev A — CONTRACTS.md defines only GET /api/operator/teachers
// and GET /api/operator/students; the operator edit modal needs
// PATCH /api/operator/teachers/:id and PATCH /api/operator/students/:id
// (institution-side equivalents exist: PATCH /api/inst/:slug/admin/{teachers,students}/:id).

/** Mutates the module-level mock row so client-side nav keeps the edit (mock persistence). */
export function mockTeacherPatched(
  id: string,
  patch: Partial<OperatorTeacherRow>
): ApiResponse<{ teacher: OperatorTeacherRow }> {
  const row = MOCK_TEACHERS.find((t) => t._id === id);
  if (row) Object.assign(row, patch);
  return ok({ teacher: { ...(row ?? MOCK_TEACHERS[0]), ...patch } }, "Teacher updated");
}

/** Mutates the module-level mock row so client-side nav keeps the edit (mock persistence). */
export function mockStudentPatched(
  id: string,
  patch: Partial<OperatorStudentRow>
): ApiResponse<{ student: OperatorStudentRow }> {
  const row = MOCK_STUDENTS.find((s) => s._id === id);
  if (row) Object.assign(row, patch);
  return ok({ student: { ...(row ?? MOCK_STUDENTS[0]), ...patch } }, "Student updated");
}

// CONTRACT GAP: flag for Dev A — OperatorStudentRow (CONTRACTS.md) carries no
// paidClasses, but the operator edit modal edits it (institution-side
// StudentDetail has it). Held in a mock-side store until Dev A either adds it
// to the row or exposes an operator student-detail endpoint.
const STUDENT_PAID_CLASSES = new Map<string, number>();

export function getMockStudentPaidClasses(id: string): number {
  let v = STUDENT_PAID_CLASSES.get(id);
  if (v === undefined) {
    const idx = MOCK_STUDENTS.findIndex((s) => s._id === id);
    const s = idx >= 0 ? MOCK_STUDENTS[idx] : null;
    v = s && s.paidAmount > 0 ? 8 + (idx % 3) * 4 : 0;
    STUDENT_PAID_CLASSES.set(id, v);
  }
  return v;
}

export function setMockStudentPaidClasses(id: string, n: number): void {
  STUDENT_PAID_CLASSES.set(id, n);
}

// ── Entity activity store (live rail in the edit modal) ──────────────────────
// Module-level store: seeded realistic history per entity + entries recorded
// from the edit modal. Shapes are plain AuditLogItem (CONTRACTS.md) — one event
// per changed field, exactly how auditLog() writes them.
// CONTRACT GAP: flag for Dev A — GET /api/operator/changes has no entityId
// filter; the modal needs entity-scoped history at operator level (mirror of
// GET /api/inst/:slug/admin/students/:id/activity).

const ACTOR_OPERATOR = { name: "Aditya Khanna", role: "superadmin" as ActorRole };
const ACTOR_SYSTEM = { name: "System", role: "system" as ActorRole };

const institutionAdminName = (instId: string): string =>
  MOCK_INSTITUTIONS.find((x) => x._id === instId)?.ownerTeacher?.name ?? "Institution Admin";

let activitySeq = 100;

function activityItem(args: {
  entity: {
    id: string;
    type: string;
    label: string | null;
    institution: { _id: string; name: string } | null;
  };
  actor: { name: string; role: ActorRole };
  field: string;
  from: unknown;
  to: unknown;
  createdAt: string;
}): AuditLogItem {
  return {
    _id: `act_${++activitySeq}`,
    institution: args.entity.institution,
    actorRole: args.actor.role,
    actorName: args.actor.name,
    impersonatedBy: null,
    action: `UPDATE_${args.field.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`,
    entityType: args.entity.type,
    entityId: args.entity.id,
    entityLabel: args.entity.label,
    changes: [{ field: args.field, from: args.from, to: args.to }],
    before: null,
    after: null,
    ip: null,
    createdAt: args.createdAt,
  };
}

const idIndex = (id: string): number => {
  const n = Number(id.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const shiftDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Deterministic "previous" mobile so seeds read like a real correction. */
const previousMobile = (mobile: string): string =>
  mobile.slice(0, 8) + String((Number(mobile.slice(8)) + 37) % 100).padStart(2, "0");

const SEEDED_ACTIVITY = new Map<string, AuditLogItem[]>();

function seededEntityActivity(entityId: string): AuditLogItem[] {
  const cached = SEEDED_ACTIVITY.get(entityId);
  if (cached) return cached;

  const i = idIndex(entityId);
  const out: AuditLogItem[] = [];
  const stu = MOCK_STUDENTS.find((s) => s._id === entityId);
  const tch = stu ? undefined : MOCK_TEACHERS.find((t) => t._id === entityId);

  if (stu) {
    const entity = {
      id: stu._id,
      type: "Student",
      label: `Student: ${stu.name}`,
      institution: { _id: stu.institution._id, name: stu.institution.name },
    };
    const admin = { name: institutionAdminName(stu.institution._id), role: "institution_admin" as ActorRole };

    if (stu.paidAmount > 0) {
      out.push(activityItem({ entity, actor: admin, field: "paidAmount", from: 0, to: stu.paidAmount,
        createdAt: `2026-06-0${1 + (i % 8)}T1${i % 9}:${String(12 + (i % 40)).padStart(2, "0")}:00.000Z` }));
    } else {
      out.push(activityItem({ entity, actor: admin, field: "upcomingAmount", from: 0, to: stu.upcomingAmount,
        createdAt: `2026-06-0${1 + (i % 8)}T0${i % 9}:${String(10 + (i % 45)).padStart(2, "0")}:00.000Z` }));
    }
    if (stu.joinStatus !== "trial") {
      out.push(activityItem({ entity, actor: ACTOR_SYSTEM, field: "joinStatus", from: "trial", to: stu.joinStatus,
        createdAt: `2026-05-${String(8 + (i % 18)).padStart(2, "0")}T00:05:00.000Z` }));
    } else {
      out.push(activityItem({ entity, actor: ACTOR_OPERATOR, field: "mobile", from: previousMobile(stu.mobile), to: stu.mobile,
        createdAt: `2026-05-${String(8 + (i % 18)).padStart(2, "0")}T12:${String(10 + (i % 45)).padStart(2, "0")}:00.000Z` }));
    }
    if (stu.validityEnd) {
      out.push(activityItem({
        entity,
        actor: i % 2 === 0 ? admin : ACTOR_OPERATOR,
        field: "validityEnd",
        from: shiftDays(stu.validityEnd, -60),
        to: stu.validityEnd,
        createdAt: `2026-04-${String(4 + (i % 22)).padStart(2, "0")}T16:${String(i % 50).padStart(2, "0")}:00.000Z`,
      }));
    }
    if (i % 3 === 1 && stu.joinStatus !== "trial") {
      out.push(activityItem({ entity, actor: ACTOR_OPERATOR, field: "mobile", from: previousMobile(stu.mobile), to: stu.mobile,
        createdAt: `2026-03-${String(3 + (i % 24)).padStart(2, "0")}T11:30:00.000Z` }));
    }
    if (i % 3 === 2) {
      out.push(activityItem({ entity, actor: admin, field: "paidClasses", from: 0, to: 8 + (i % 3) * 4,
        createdAt: `2026-02-${String(5 + (i % 20)).padStart(2, "0")}T09:45:00.000Z` }));
    }
    if (out.length < 3) {
      out.push(activityItem({ entity, actor: admin, field: "name", from: stu.name.split(" ")[0], to: stu.name,
        createdAt: `2026-02-${String(2 + (i % 24)).padStart(2, "0")}T10:15:00.000Z` }));
    }
  } else if (tch) {
    const entity = {
      id: tch._id,
      type: "Teacher",
      label: `Teacher: ${tch.name}`,
      institution: { _id: tch.institution._id, name: tch.institution.name },
    };
    // owners are edited by the operator; staff teachers by their institution admin
    const admin =
      tch.role === "owner"
        ? ACTOR_OPERATOR
        : { name: institutionAdminName(tch.institution._id), role: "institution_admin" as ActorRole };

    if (tch.amount != null) {
      out.push(activityItem({
        entity, actor: ACTOR_OPERATOR, field: "salaryAmount",
        from: tch.amount - (200000 + (i % 4) * 100000), to: tch.amount,
        createdAt: `2026-06-0${1 + (i % 8)}T1${i % 9}:${String(5 + (i % 50)).padStart(2, "0")}:00.000Z`,
      }));
    }
    out.push(activityItem({
      entity, actor: admin, field: "status",
      from: tch.status === "inactive" ? "active" : "inactive",
      to: tch.status,
      createdAt: `2026-05-${String(6 + (i % 20)).padStart(2, "0")}T15:${String(i % 55).padStart(2, "0")}:00.000Z`,
    }));
    out.push(activityItem({ entity, actor: admin, field: "mobile", from: previousMobile(tch.mobile), to: tch.mobile,
      createdAt: `2026-04-${String(2 + (i % 24)).padStart(2, "0")}T10:20:00.000Z` }));
    if (i % 3 === 0) {
      out.push(activityItem({ entity, actor: ACTOR_OPERATOR, field: "name", from: tch.name.split(" ")[0], to: tch.name,
        createdAt: `2026-03-${String(4 + (i % 22)).padStart(2, "0")}T13:10:00.000Z` }));
    }
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
  SEEDED_ACTIVITY.set(entityId, out);
  return out;
}

const RECORDED_ACTIVITY = new Map<string, AuditLogItem[]>();

/** Entity-scoped activity feed, newest first (recorded edits + seeded history). */
export function getEntityActivity(entityId: string): AuditLogItem[] {
  return [...(RECORDED_ACTIVITY.get(entityId) ?? []), ...seededEntityActivity(entityId)];
}

/**
 * Record one event per changed field (mirrors how auditLog() stores changes[]).
 * Returns the created items in the order the fields were changed; the store
 * keeps newest first.
 */
export function recordEntityActivity(
  entityId: string,
  changes: { field: string; from: unknown; to: unknown }[],
  actor: { name: string; role: ActorRole }
): AuditLogItem[] {
  const stu = MOCK_STUDENTS.find((s) => s._id === entityId);
  const tch = stu ? undefined : MOCK_TEACHERS.find((t) => t._id === entityId);
  const entity = stu
    ? { id: stu._id, type: "Student", label: `Student: ${stu.name}`,
        institution: { _id: stu.institution._id, name: stu.institution.name } }
    : tch
      ? { id: tch._id, type: "Teacher", label: `Teacher: ${tch.name}`,
          institution: { _id: tch.institution._id, name: tch.institution.name } }
      : { id: entityId, type: "Entity", label: null, institution: null };

  const base = Date.now();
  const items = changes.map((c, idx) =>
    activityItem({
      entity,
      actor,
      field: c.field,
      from: c.from,
      to: c.to,
      createdAt: new Date(base + idx).toISOString(),
    })
  );
  RECORDED_ACTIVITY.set(entityId, [...items].reverse().concat(RECORDED_ACTIVITY.get(entityId) ?? []));
  return items;
}

export const mockEntityActivity = (entityId: string): ApiResponse<Paginated<AuditLogItem>> =>
  ok(paginate(getEntityActivity(entityId), 1, 50));

// ── Payments: student fees ────────────────────────────────────────────────────

type PaymentSeed = [
  student: string,
  instId: string,
  type: "fee" | "admission",
  period: string | null,
  amount: number,
  status: OperatorPaymentRow["status"],
  method: OperatorPaymentRow["method"],
  paidAt: string | null,
];

const PAYMENT_SEEDS: PaymentSeed[] = [
  ["Aarav Sharma", "inst_01", "fee", "Jun 2026", 600000, "paid", "razorpay", "2026-06-03T10:12:00.000Z"],
  ["Ananya Iyer", "inst_01", "fee", "Jun 2026", 450000, "paid", "manual", "2026-06-02T15:40:00.000Z"],
  ["Diya Patel", "inst_03", "fee", "Jun 2026", 500000, "paid", "razorpay", "2026-06-05T09:05:00.000Z"],
  ["Kabir Singh", "inst_06", "fee", "Jun 2026", 700000, "paid", "razorpay", "2026-06-01T18:30:00.000Z"],
  ["Rohan Verma", "inst_02", "fee", "Jun 2026", 350000, "partial", "cash", "2026-06-06T12:00:00.000Z"],
  ["Meera Krishnan", "inst_01", "fee", "May 2026", 600000, "overdue", "manual", null],
  ["Sneha Joshi", "inst_05", "fee", "Apr 2026", 300000, "overdue", "manual", null],
  ["Vihaan Gupta", "inst_02", "admission", null, 100000, "free", "manual", "2026-05-28T11:00:00.000Z"],
  ["Tanvi Kulkarni", "inst_06", "fee", "Jun 2026", 700000, "paid", "razorpay", "2026-06-04T20:15:00.000Z"],
  ["Priya Menon", "inst_03", "fee", "Jun 2026", 500000, "paid", "razorpay", "2026-06-07T08:45:00.000Z"],
  ["Harsh Vora", "inst_04", "fee", "Jun 2026", 400000, "paid", "cash", "2026-06-02T17:20:00.000Z"],
  ["Riya Chatterjee", "inst_04", "fee", "May 2026", 320000, "overdue", "manual", null],
  ["Avni Trivedi", "inst_01", "fee", "Jun 2026", 600000, "paid", "razorpay", "2026-06-08T13:10:00.000Z"],
  ["Lakshmi Pillai", "inst_03", "admission", null, 150000, "paid", "manual", "2026-05-12T10:00:00.000Z"],
  ["Om Prakash Yadav", "inst_02", "fee", "Jun 2026", 350000, "partial", "cash", "2026-06-05T16:00:00.000Z"],
  ["Shaurya Kapoor", "inst_03", "fee", "Jun 2026", 620000, "paid", "razorpay", "2026-06-06T19:25:00.000Z"],
];

export const MOCK_PAYMENTS: OperatorPaymentRow[] = PAYMENT_SEEDS.map(
  ([student, instId, type, period, amount, status, method, paidAt], i) => ({
    _id: `pay_${String(i + 1).padStart(2, "0")}`,
    student: { _id: `stu_${String(i + 1).padStart(2, "0")}`, name: student },
    institution: { _id: instId, name: instTag(instId).name },
    type,
    period,
    amount,
    status,
    method,
    paidAt,
  })
);

export function mockPaymentList(params: {
  page?: number;
  limit?: number;
  institutionId?: string;
  status?: string;
}): ApiResponse<Paginated<OperatorPaymentRow>> {
  let rows = MOCK_PAYMENTS;
  if (params.institutionId)
    rows = rows.filter((r) => r.institution._id === params.institutionId);
  if (params.status && params.status !== "all")
    rows = rows.filter((r) => r.status === params.status);
  return ok(paginate(rows, params.page, params.limit ?? 10));
}

// ── Payments: rent invoices ───────────────────────────────────────────────────

export const MOCK_RENT_INVOICES: RentInvoiceItem[] = [
  { _id: "rent_01", institution: { _id: "inst_01", name: "Swar Sadhana Music Academy" }, period: "Jun 2026", amount: 2500000, dueDate: "2026-06-01T00:00:00.000Z", status: "paid", paidAt: "2026-05-30T09:00:00.000Z", reference: "NEFT-88412" },
  { _id: "rent_02", institution: { _id: "inst_03", name: "Sangeet Niketan Delhi" }, period: "Jun 2026", amount: 4000000, dueDate: "2026-06-01T00:00:00.000Z", status: "overdue", paidAt: null, reference: null },
  { _id: "rent_03", institution: { _id: "inst_05", name: "Sur Sangam Vocal Academy" }, period: "May 2026", amount: 1800000, dueDate: "2026-05-01T00:00:00.000Z", status: "overdue", paidAt: null, reference: null },
  { _id: "rent_04", institution: { _id: "inst_06", name: "Riyaaz Piano Studio" }, period: "Jun 2026", amount: 2200000, dueDate: "2026-06-05T00:00:00.000Z", status: "pending", paidAt: null, reference: null },
  { _id: "rent_05", institution: { _id: "inst_01", name: "Swar Sadhana Music Academy" }, period: "May 2026", amount: 2500000, dueDate: "2026-05-01T00:00:00.000Z", status: "paid", paidAt: "2026-04-29T11:30:00.000Z", reference: "NEFT-81230" },
  { _id: "rent_06", institution: { _id: "inst_03", name: "Sangeet Niketan Delhi" }, period: "May 2026", amount: 4000000, dueDate: "2026-05-01T00:00:00.000Z", status: "paid", paidAt: "2026-05-03T14:00:00.000Z", reference: "UPI-7741290" },
  { _id: "rent_07", institution: { _id: "inst_06", name: "Riyaaz Piano Studio" }, period: "May 2026", amount: 2200000, dueDate: "2026-05-05T00:00:00.000Z", status: "paid", paidAt: "2026-05-04T10:10:00.000Z", reference: "UPI-6650113" },
  { _id: "rent_08", institution: { _id: "inst_05", name: "Sur Sangam Vocal Academy" }, period: "Apr 2026", amount: 1800000, dueDate: "2026-04-01T00:00:00.000Z", status: "overdue", paidAt: null, reference: null },
];

export function mockRentInvoiceList(params: {
  page?: number;
  limit?: number;
  institutionId?: string;
  status?: string;
}): ApiResponse<Paginated<RentInvoiceItem>> {
  let rows = MOCK_RENT_INVOICES;
  if (params.institutionId)
    rows = rows.filter((r) => r.institution._id === params.institutionId);
  if (params.status && params.status !== "all")
    rows = rows.filter((r) => r.status === params.status);
  return ok(paginate(rows, params.page, params.limit ?? 10));
}

export const mockMarkRentPaid = (
  invoice: RentInvoiceItem,
  reference: string | null
): ApiResponse<RentInvoiceItem> =>
  ok(
    { ...invoice, status: "paid", paidAt: new Date().toISOString(), reference },
    "Rent invoice marked paid"
  );

// ── Changes history (audit log) ───────────────────────────────────────────────

export const MOCK_AUDIT_LOG: AuditLogItem[] = [
  {
    _id: "log_01",
    institution: { _id: "inst_03", name: "Sangeet Niketan Delhi" },
    actorRole: "institution_admin",
    actorName: "Anjali Deshmukh",
    impersonatedBy: null,
    action: "UPDATE_PAID_AMOUNT",
    entityType: "Student",
    entityId: "stu_04",
    entityLabel: "Student: Diya Patel",
    changes: [{ field: "paidAmount", from: 0, to: 500000 }],
    before: { paidAmount: 0, upcomingAmount: 500000 },
    after: { paidAmount: 500000, upcomingAmount: 500000 },
    ip: "103.27.9.41",
    createdAt: "2026-06-09T14:22:00.000Z",
  },
  {
    _id: "log_02",
    institution: { _id: "inst_02", name: "Taal Tarang Tabla Academy" },
    actorRole: "superadmin",
    actorName: "Aditya Khanna",
    impersonatedBy: "op_000000000000000000000001",
    action: "APPROVE_REQUEST",
    entityType: "EnrollmentRequest",
    entityId: "req_31",
    entityLabel: "Request: Nikhil Saxena",
    changes: [{ field: "status", from: "pending", to: "approved" }],
    before: { status: "pending", paymentStatus: "unpaid" },
    after: { status: "approved", paymentStatus: "unpaid" },
    ip: "49.36.121.8",
    createdAt: "2026-06-09T11:05:00.000Z",
  },
  {
    _id: "log_03",
    institution: { _id: "inst_01", name: "Swar Sadhana Music Academy" },
    actorRole: "system",
    actorName: "System",
    impersonatedBy: null,
    action: "UPDATE_JOIN_STATUS",
    entityType: "Student",
    entityId: "stu_06",
    entityLabel: "Student: Ishita Reddy",
    changes: [{ field: "joinStatus", from: "active_soon", to: "active" }],
    before: { joinStatus: "active_soon" },
    after: { joinStatus: "active" },
    ip: null,
    createdAt: "2026-06-09T00:05:00.000Z",
  },
  {
    _id: "log_04",
    institution: { _id: "inst_01", name: "Swar Sadhana Music Academy" },
    actorRole: "superadmin",
    actorName: "Aditya Khanna",
    impersonatedBy: null,
    action: "TOGGLE_MODE",
    entityType: "Institution",
    entityId: "inst_01",
    entityLabel: "Institution: Swar Sadhana Music Academy",
    changes: [
      { field: "mode", from: "managed", to: "autonomous" },
      { field: "ownerTeacher.panelAccess", from: ["teacher"], to: ["teacher", "admin"] },
    ],
    before: { mode: "managed" },
    after: { mode: "autonomous" },
    ip: "49.36.121.8",
    createdAt: "2026-06-08T16:40:00.000Z",
  },
  {
    _id: "log_05",
    institution: { _id: "inst_04", name: "Melody Makers Guitar School" },
    actorRole: "teacher",
    actorName: "Suresh Menon",
    impersonatedBy: null,
    action: "MARK_ATTENDANCE",
    entityType: "Attendance",
    entityId: "att_882",
    entityLabel: "Batch: GTR-TTS-6PM · 8 Jun 2026",
    changes: [{ field: "present", from: null, to: 11 }],
    before: null,
    after: { present: 11, absent: 2 },
    ip: "106.51.77.2",
    createdAt: "2026-06-08T18:35:00.000Z",
  },
  {
    _id: "log_06",
    institution: { _id: "inst_06", name: "Riyaaz Piano Studio" },
    actorRole: "institution_admin",
    actorName: "Imran Shaikh",
    impersonatedBy: null,
    action: "CREATE_BATCH",
    entityType: "Batch",
    entityId: "batch_inst_06_4",
    entityLabel: "Batch: PNO-SS-11AM",
    changes: [],
    before: null,
    after: { name: "PNO-SS-11AM", instrument: "Piano", status: "setting" },
    ip: "157.49.211.90",
    createdAt: "2026-06-08T10:18:00.000Z",
  },
  {
    _id: "log_07",
    institution: { _id: "inst_05", name: "Sur Sangam Vocal Academy" },
    actorRole: "superadmin",
    actorName: "Aditya Khanna",
    impersonatedBy: null,
    action: "SUSPEND_INSTITUTION",
    entityType: "Institution",
    entityId: "inst_05",
    entityLabel: "Institution: Sur Sangam Vocal Academy",
    changes: [{ field: "status", from: "active", to: "suspended" }],
    before: { status: "active" },
    after: { status: "suspended" },
    ip: "49.36.121.8",
    createdAt: "2026-06-07T12:50:00.000Z",
  },
  {
    _id: "log_08",
    institution: { _id: "inst_03", name: "Sangeet Niketan Delhi" },
    actorRole: "teacher",
    actorName: "Neha Bhatt",
    impersonatedBy: null,
    action: "CREATE_HOLIDAY",
    entityType: "Holiday",
    entityId: "hol_19",
    entityLabel: "Batch: VOC-MWF-5PM · 12 Jun 2026",
    changes: [],
    before: null,
    after: { date: "2026-06-12", studentCategory: "regular", reason: "Sankranti utsav" },
    ip: "103.27.9.44",
    createdAt: "2026-06-07T09:30:00.000Z",
  },
  {
    _id: "log_09",
    institution: { _id: "inst_02", name: "Taal Tarang Tabla Academy" },
    actorRole: "system",
    actorName: "System",
    impersonatedBy: null,
    action: "UPDATE_JOIN_STATUS",
    entityType: "Student",
    entityId: "stu_10",
    entityLabel: "Student: Sneha Joshi",
    changes: [{ field: "joinStatus", from: "active", to: "inactive" }],
    before: { joinStatus: "active", validityEnd: "2026-03-31" },
    after: { joinStatus: "inactive", validityEnd: "2026-03-31" },
    ip: null,
    createdAt: "2026-06-06T00:05:00.000Z",
  },
  {
    _id: "log_10",
    institution: { _id: "inst_07", name: "Naad Flute Academy" },
    actorRole: "superadmin",
    actorName: "Aditya Khanna",
    impersonatedBy: null,
    action: "CREATE_INSTITUTION",
    entityType: "Institution",
    entityId: "inst_07",
    entityLabel: "Institution: Naad Flute Academy",
    changes: [],
    before: null,
    after: { name: "Naad Flute Academy", mode: "managed", status: "pending" },
    ip: "49.36.121.8",
    createdAt: "2026-05-29T12:00:00.000Z",
  },
  {
    _id: "log_11",
    institution: { _id: "inst_01", name: "Swar Sadhana Music Academy" },
    actorRole: "institution_admin",
    actorName: "Pandit Ramesh Iyer",
    impersonatedBy: null,
    action: "UPDATE_VALIDITY",
    entityType: "Student",
    entityId: "stu_25",
    entityLabel: "Student: Avni Trivedi",
    changes: [
      { field: "validityEnd", from: "2026-06-22", to: "2026-08-22" },
      { field: "paidClasses", from: 0, to: 16 },
    ],
    before: { validityEnd: "2026-06-22", paidClasses: 0 },
    after: { validityEnd: "2026-08-22", paidClasses: 16 },
    ip: "103.27.10.2",
    createdAt: "2026-06-05T17:42:00.000Z",
  },
  {
    _id: "log_12",
    institution: { _id: "inst_03", name: "Sangeet Niketan Delhi" },
    actorRole: "superadmin",
    actorName: "Aditya Khanna",
    impersonatedBy: "op_000000000000000000000001",
    action: "MARK_RENT_PAID",
    entityType: "RentInvoice",
    entityId: "rent_06",
    entityLabel: "Rent: Sangeet Niketan Delhi · May 2026",
    changes: [{ field: "status", from: "pending", to: "paid" }],
    before: { status: "pending", paidAt: null },
    after: { status: "paid", paidAt: "2026-05-03T14:00:00.000Z" },
    ip: "49.36.121.8",
    createdAt: "2026-05-03T14:00:00.000Z",
  },
];

export function mockChangesList(params: {
  page?: number;
  limit?: number;
  institutionId?: string;
  actorRole?: string;
  from?: string | null;
  to?: string | null;
}): ApiResponse<Paginated<AuditLogItem>> {
  let rows = MOCK_AUDIT_LOG;
  if (params.institutionId)
    rows = rows.filter((r) => r.institution?._id === params.institutionId);
  if (params.actorRole && params.actorRole !== "all")
    rows = rows.filter((r) => r.actorRole === params.actorRole);
  if (params.from) rows = rows.filter((r) => r.createdAt >= `${params.from}T00:00:00.000Z`);
  if (params.to) rows = rows.filter((r) => r.createdAt <= `${params.to}T23:59:59.999Z`);
  return ok(paginate(rows, params.page, params.limit ?? 8));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const mockDashboard = (): ApiResponse<OperatorDashboardData> =>
  ok({
    institutions: { total: 8, active: 5, suspended: 1 },
    totals: { students: 297, teachers: 21 },
    revenue: {
      rentCollectedThisMonth: 2500000, // ₹ 25,000
      rentOverdue: 7600000, // ₹ 76,000 across 3 invoices
      feeCollectedThisMonth: 28600000, // ₹ 2,86,000
    },
    recentChanges: MOCK_AUDIT_LOG.slice(0, 6),
    overdueRents: MOCK_RENT_INVOICES.filter((r) => r.status === "overdue"),
  });

/** Fee collection trend, Jan–Jun 2026 — amounts in paise. */
export const MOCK_FEE_TREND = [
  { month: "Jan", collected: 16400000 },
  { month: "Feb", collected: 19800000 },
  { month: "Mar", collected: 22150000 },
  { month: "Apr", collected: 20700000 },
  { month: "May", collected: 26300000 },
  { month: "Jun", collected: 28600000 },
];

// ── Settings ──────────────────────────────────────────────────────────────────

export const MOCK_SETTINGS: OperatorSettingsData = {
  profile: { name: MOCK_OPERATOR.name, email: MOCK_OPERATOR.email },
  twoFactorEnabled: true,
  defaultRent: { amount: 2500000, billingCycle: "monthly" },
  instruments: [
    { _id: "ins_01", name: "Sitar", isActive: true },
    { _id: "ins_02", name: "Tabla", isActive: true },
    { _id: "ins_03", name: "Vocal", isActive: true },
    { _id: "ins_04", name: "Guitar", isActive: true },
    { _id: "ins_05", name: "Piano", isActive: true },
    { _id: "ins_06", name: "Flute", isActive: true },
    { _id: "ins_07", name: "Veena", isActive: true },
    { _id: "ins_08", name: "Harmonium", isActive: true },
    { _id: "ins_09", name: "Keyboard", isActive: true },
    { _id: "ins_10", name: "Violin", isActive: false },
  ],
};

export const mockSettings = (): ApiResponse<OperatorSettingsData> => ok(MOCK_SETTINGS);

export const mockSettingsSaved = (settings: OperatorSettingsData): ApiResponse<OperatorSettingsData> =>
  ok(settings, "Settings saved");

export const mock2faEnableStart = (): ApiResponse<{ otpauthUrl: string; secret: string }> =>
  ok(
    { otpauthUrl: "otpauth://totp/OperatorConsole:operator?secret=JBSWY3DPEHPK3PXP", secret: "JBSW Y3DP EHPK 3PXP" },
    "Scan the QR with your authenticator app"
  );

export const mock2faVerified = (): ApiResponse<{ twoFactorEnabled: boolean }> =>
  ok({ twoFactorEnabled: true }, "Two-factor authentication enabled");

export const mock2faDisabled = (): ApiResponse<{ twoFactorEnabled: boolean }> =>
  ok({ twoFactorEnabled: false }, "Two-factor authentication disabled");

// ── Shared select options (filters) ───────────────────────────────────────────

export const INSTITUTION_OPTIONS = MOCK_INSTITUTIONS.map((i) => ({
  value: i._id,
  label: i.name,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Slug change requests (filed by institution admins, decided here)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SLUG_REQUESTS: SlugChangeRequestRow[] = [
  {
    _id: "slugreq_01",
    institution: { _id: MOCK_INSTITUTIONS[1]._id, name: MOCK_INSTITUTIONS[1].name, slug: MOCK_INSTITUTIONS[1].slug },
    currentSlug: MOCK_INSTITUTIONS[1].slug,
    requestedSlug: "taal-tarang-academy",
    reason: "Shorter address for our flyers",
    status: "pending",
    requestedBy: { actorName: MOCK_INSTITUTIONS[1].ownerTeacher?.name ?? null },
    handledAt: null,
    rejectionReason: null,
    createdAt: "2026-06-09T10:20:00.000Z",
  },
  {
    _id: "slugreq_02",
    institution: { _id: MOCK_INSTITUTIONS[0]._id, name: MOCK_INSTITUTIONS[0].name, slug: MOCK_INSTITUTIONS[0].slug },
    currentSlug: MOCK_INSTITUTIONS[0].slug,
    requestedSlug: "swar-sadhana",
    reason: null,
    status: "pending",
    requestedBy: { actorName: MOCK_INSTITUTIONS[0].ownerTeacher?.name ?? null },
    handledAt: null,
    rejectionReason: null,
    createdAt: "2026-06-08T15:05:00.000Z",
  },
  {
    _id: "slugreq_03",
    institution: { _id: MOCK_INSTITUTIONS[2]?._id ?? "inst_03", name: MOCK_INSTITUTIONS[2]?.name, slug: MOCK_INSTITUTIONS[2]?.slug },
    currentSlug: "riyaz-piano-studio",
    requestedSlug: "riyaaz-piano-studio",
    reason: "Spelling fix",
    status: "approved",
    requestedBy: { actorName: MOCK_INSTITUTIONS[2]?.ownerTeacher?.name ?? null },
    handledAt: "2026-05-22T09:00:00.000Z",
    rejectionReason: null,
    createdAt: "2026-05-21T13:45:00.000Z",
  },
];

export function mockSlugRequestList(params: {
  page?: number;
  limit?: number;
  status?: string;
}): ApiResponse<Paginated<SlugChangeRequestRow>> {
  const { page = 1, limit = 20, status = "pending" } = params;
  const filtered =
    status && status !== "all"
      ? MOCK_SLUG_REQUESTS.filter((r) => r.status === status)
      : MOCK_SLUG_REQUESTS;
  return ok(paginate(filtered, page, limit));
}

/** Mutates the mock row (and mirrors an approved slug onto the institution). */
export function mockSlugRequestHandled(
  id: string,
  status: "approved" | "rejected",
  rejectionReason?: string
): ApiResponse<null> {
  const row = MOCK_SLUG_REQUESTS.find((r) => r._id === id);
  if (row) {
    row.status = status;
    row.handledAt = new Date().toISOString();
    if (status === "rejected") row.rejectionReason = rejectionReason ?? null;
    if (status === "approved") {
      const inst = MOCK_INSTITUTIONS.find((i) => i._id === row.institution._id);
      if (inst) inst.slug = row.requestedSlug;
    }
  }
  return ok(null, status === "approved" ? "Slug change approved" : "Slug change rejected");
}
