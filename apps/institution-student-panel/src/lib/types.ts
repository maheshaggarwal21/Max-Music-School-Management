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
  /** meetingUrl is set only for ONLINE batches with a launched session on that date (B1+). */
  upcomingClass: (ClassItem & { meetingUrl?: string | null }) | null;
  holidayNotice: string | null;
  attendance: { percent: number; present: number; total: number };
  credentials: { displayId: string; schedule: string | null; sessionSlot: string | null };
  /** A5 — plan facts: window, plan length, purchased + upcoming classes. */
  validity: {
    start: string | null;
    end: string | null;
    days: number | null;
    paidClasses: number;
    upcomingClasses: number;
  };
  timetable: ClassItem[];
}

// ── Contact (GET /contact) ──────────────────────────────────────────────────
// The student's own teacher + the institution's support contact. WHITE-LABEL:
// only the institution's own identity is ever returned here.

export interface ContactInfo {
  teacher: { name: string; mobile: string } | null;
  support: { schoolName: string; email: string | null };
}
