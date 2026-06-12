// H2 migration done — shared contract types come from @maxmusic/types
// (Dev A owns; Dev B reads). Per-panel view/row shapes remain local below.
import type { ApiResponse, Paginated, BrandingPublic } from "@maxmusic/types";
export type { ApiResponse, Paginated, BrandingPublic };

// ── Me ────────────────────────────────────────────────────────────────────────

export interface StudentSelf {
  _id: string;
  displayId: string;
  name: string;
  mobile: string;
  /** OTP login works only after the student verifies their number. */
  mobileVerified: boolean;
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
