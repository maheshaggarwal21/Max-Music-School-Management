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

// ── Branding (white-label safe) ───────────────────────────────────────────────

export interface BrandingPublic {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

// ── Me ────────────────────────────────────────────────────────────────────────

export interface StudentSelf {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  instrument: string | null;
  joinStatus: string;
  validityEnd: string | null;
}

// ── Classes / timetable ───────────────────────────────────────────────────────

export interface ClassItem {
  date: string;
  batchName: string;
  time: string;
  status: "present" | "absent" | "upcoming" | "holiday";
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
// GET /dashboard — upcomingClass/holidayNotice are loosely typed in CONTRACTS.md;
// confirm exact shapes with Dev A before wiring (do not extend locally).

export interface StudentDashboard {
  upcomingClass: ClassItem | null;
  holidayNotice: string | null;
  attendance: { percent: number; present: number; total: number };
  credentials: { displayId: string; schedule: string | null; sessionSlot: string | null };
  timetable: ClassItem[];
}
