// Single source of mock data for the institution student panel (MOCK MODE —
// NEXT_PUBLIC_API_URL unset). All shapes mirror CONTRACTS.md; the few view
// shapes marked "PENDING CONTRACT" below are mock-only and must be replaced
// once Dev A adds them to CONTRACTS.md (do NOT wire them to real endpoints).
//
// WHITE-LABEL: the only identity here is the mock institution's BrandingPublic.
// The operator's name/domain must NEVER appear in this file.

import type {
  BrandingPublic,
  ClassItem,
  Paginated,
  StudentDashboard,
  StudentSelf,
} from "./types";

// ── Branding (BrandingPublic — CONTRACTS.md) ─────────────────────────────────

export const MOCK_BRANDING: BrandingPublic = {
  slug: "sunrise-school-of-music",
  schoolName: "Sunrise School of Music",
  logoUrl: null, // null ⇒ initials fallback in the sidebar / login hero
  primaryColor: "#D97706", // warm amber — institution's own brand, not operator's
  tagline: "Where every day begins with music",
};

// ── Me (GET /api/inst/:slug/student/me) ──────────────────────────────────────

export const MOCK_STUDENT: StudentSelf = {
  _id: "stu_660aa1b2c3d4e5f601",
  displayId: "SSM-STU-0042",
  name: "Aarav Sharma",
  mobile: "9876543210",
  instrument: "Piano",
  joinStatus: "active",
  validityEnd: "2026-07-14",
};

export interface MeResponse {
  student: StudentSelf;
  institution: BrandingPublic;
}

export const MOCK_ME: MeResponse = {
  student: MOCK_STUDENT,
  institution: MOCK_BRANDING,
};

// ── Login (POST /api/inst/:slug/auth/student/login) ──────────────────────────

export interface StudentLoginResponse {
  user: {
    _id: string;
    name: string;
    displayId: string;
    role: "student";
    institutionId: string;
  };
  institution: BrandingPublic;
}

export const MOCK_LOGIN_RESPONSE: StudentLoginResponse = {
  user: {
    _id: MOCK_STUDENT._id,
    name: MOCK_STUDENT.name,
    displayId: MOCK_STUDENT.displayId,
    role: "student",
    institutionId: "inst_65f001a2b3c4d5e6f7",
  },
  institution: MOCK_BRANDING,
};

// ── Class history (GET /classes — attendance history, newest first) ──────────
// Batch: Piano Evening Batch · Tue & Thu · 5:00 PM – 6:00 PM (all dates 2026).

const BATCH = "Piano Evening Batch";
const SLOT = "5:00 PM – 6:00 PM";

const session = (date: string, status: ClassItem["status"]): ClassItem => ({
  date,
  batchName: BATCH,
  time: SLOT,
  status,
});

/** Past sessions only — newest first (matches GET /classes). */
export const MOCK_CLASS_HISTORY: ClassItem[] = [
  session("2026-06-09", "present"),
  session("2026-06-04", "present"),
  session("2026-06-02", "absent"),
  session("2026-05-28", "present"),
  session("2026-05-26", "present"),
  session("2026-05-21", "present"),
  session("2026-05-19", "present"),
  session("2026-05-14", "holiday"), // class credited back automatically
  session("2026-05-12", "present"),
  session("2026-05-07", "present"),
  session("2026-05-05", "absent"),
  session("2026-04-30", "present"),
  session("2026-04-28", "present"),
  session("2026-04-23", "present"),
  session("2026-04-21", "present"),
  session("2026-04-16", "present"),
  session("2026-04-14", "present"),
  session("2026-04-09", "present"),
  session("2026-04-07", "present"),
  session("2026-04-02", "present"),
];

export const MOCK_CLASSES: Paginated<ClassItem> = {
  items: MOCK_CLASS_HISTORY,
  pagination: { page: 1, limit: 50, total: MOCK_CLASS_HISTORY.length, pages: 1 },
};

// ── Timetable (GET /timetable — upcoming sessions) ───────────────────────────

export const MOCK_TIMETABLE: ClassItem[] = [
  session("2026-06-11", "upcoming"),
  session("2026-06-16", "upcoming"),
  session("2026-06-18", "holiday"), // Summer Recital Day — struck through in the grid
  session("2026-06-23", "upcoming"),
  session("2026-06-25", "upcoming"),
  session("2026-06-30", "upcoming"),
  session("2026-07-02", "upcoming"),
  session("2026-07-07", "upcoming"),
  session("2026-07-09", "upcoming"),
  session("2026-07-14", "upcoming"),
];

// ── Dashboard (GET /dashboard) ───────────────────────────────────────────────
// 17 present + 2 absent = 19 marked sessions → 89% attendance.

export const MOCK_DASHBOARD: StudentDashboard = {
  upcomingClass: session("2026-06-11", "upcoming"),
  holidayNotice:
    "Classes are off on 18 Jun 2026 for Summer Recital Day — your class credit is added back automatically.",
  attendance: { percent: 89, present: 17, total: 19 },
  credentials: {
    displayId: MOCK_STUDENT.displayId,
    schedule: "Tue & Thu",
    sessionSlot: SLOT,
  },
  timetable: MOCK_TIMETABLE,
};

// ─────────────────────────────────────────────────────────────────────────────
// PENDING CONTRACT — view shapes below are NOT in CONTRACTS.md's student
// section yet. Mock-only: requested from Dev A (class balance on /dashboard or
// /me, plus a GET /payments student endpoint). Do not wire to real endpoints.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassBalance {
  paidClasses: number;
  classesUsed: number; // present + absent (holidays are credited back)
  validityStart: string;
  validityEnd: string;
}

export const MOCK_CLASS_BALANCE: ClassBalance = {
  paidClasses: 24,
  classesUsed: 19,
  validityStart: "2026-05-15",
  validityEnd: "2026-07-14",
};

export interface StudentPaymentItem {
  _id: string;
  type: "fee" | "admission";
  period: string | null;
  amount: number; // paise — render via formatCurrency
  classesPurchased: number;
  method: "razorpay" | "manual" | "cash";
  status: "paid" | "overdue" | "partial" | "free";
  paidAt: string | null;
}

export const MOCK_PAYMENTS: StudentPaymentItem[] = [
  {
    _id: "pay_6650f1",
    type: "fee",
    period: "May – Jul 2026",
    amount: 600000, // ₹ 6,000
    classesPurchased: 12,
    method: "razorpay",
    status: "paid",
    paidAt: "2026-05-15",
  },
  {
    _id: "pay_6601c2",
    type: "fee",
    period: "Mar – May 2026",
    amount: 600000, // ₹ 6,000
    classesPurchased: 12,
    method: "manual",
    status: "paid",
    paidAt: "2026-03-16",
  },
  {
    _id: "pay_6601a9",
    type: "admission",
    period: null,
    amount: 150000, // ₹ 1,500
    classesPurchased: 0,
    method: "cash",
    status: "paid",
    paidAt: "2026-03-16",
  },
];

export interface StudentProfileExtras {
  email: string | null;
  batchName: string | null;
  schedule: string | null;
  sessionSlot: string | null;
  guardianName: string | null;
  guardianMobile: string | null;
}

export const MOCK_PROFILE_EXTRAS: StudentProfileExtras = {
  email: "aarav.sharma@example.com",
  batchName: BATCH,
  schedule: "Tue & Thu",
  sessionSlot: SLOT,
  guardianName: "Rohit Sharma",
  guardianMobile: "9876501234",
};
