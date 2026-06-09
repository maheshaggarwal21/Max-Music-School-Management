// Domain enums as const objects + union types.
// NOTE: these mirror the backend enums in .claude/orchestrate/data-model.md.
// At Handoff H2, packages/types (Dev A) becomes the canonical source for API
// shapes — these constants stay here as the runtime values frontends iterate over.

export const JOIN_STATUS = {
  TRIAL: "trial",
  ACTIVE_SOON: "active_soon",
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;
export type JoinStatus = (typeof JOIN_STATUS)[keyof typeof JOIN_STATUS];

export const INSTITUTION_MODE = {
  MANAGED: "managed",
  AUTONOMOUS: "autonomous",
} as const;
export type InstitutionMode =
  (typeof INSTITUTION_MODE)[keyof typeof INSTITUTION_MODE];

export const INSTITUTION_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  TERMINATED: "terminated",
} as const;
export type InstitutionStatus =
  (typeof INSTITUTION_STATUS)[keyof typeof INSTITUTION_STATUS];

export const PANEL_ACCESS = {
  TEACHER: "teacher",
  ADMIN: "admin",
} as const;
export type PanelAccess = (typeof PANEL_ACCESS)[keyof typeof PANEL_ACCESS];

export const ACTOR_ROLES = {
  SUPERADMIN: "superadmin",
  INSTITUTION_ADMIN: "institution_admin",
  TEACHER: "teacher",
  STUDENT: "student",
  SYSTEM: "system",
} as const;
export type ActorRole = (typeof ACTOR_ROLES)[keyof typeof ACTOR_ROLES];

export const PAYMENT_STATUS = {
  PAID: "paid",
  OVERDUE: "overdue",
  PARTIAL: "partial",
  FREE: "free",
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const BATCH_STATUS = {
  SETTING: "setting",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const;
export type BatchStatus = (typeof BATCH_STATUS)[keyof typeof BATCH_STATUS];

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  HOLIDAY: "holiday",
  CREDITED: "credited",
  UNMARKED: "unmarked",
} as const;
export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
