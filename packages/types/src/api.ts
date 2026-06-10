// ─────────────────────────────────────────────────────────────────────────────
// API response/request shapes — mirrors .claude/CONTRACTS.md
// Universal envelope + pagination. Per-endpoint payloads are extended here as
// controllers are written.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrandingPublic, Panel, ActorRole } from './models';

// ── Envelope ─────────────────────────────────────────────────────────────────
export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T | null;
}

// ── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// ── Auth: Operator ───────────────────────────────────────────────────────────
export interface OperatorLoginReq { email: string; password: string }
export interface OperatorLoginRes {
  twoFactorRequired: true;
  challengeToken: string;
}

export interface OperatorVerify2faReq { challengeToken: string; code: string }
export interface OperatorVerify2faRes {
  operator: { _id: string; name: string; email: string; role: 'superadmin' };
}

// ── Auth: Institution ────────────────────────────────────────────────────────
export interface InstAdminLoginReq    { email: string; password: string }
export interface InstTeacherLoginReq  { mobile: string; password: string }
export interface InstStudentLoginReq  { mobile: string; password: string }

export interface InstAuthUser {
  _id: string;
  name: string;
  role: 'institution_admin' | 'teacher' | 'student';
  institutionId: string;
  panelAccess?: Panel[];
  displayId?: string;
}

export interface InstAuthRes {
  user: InstAuthUser;
  institution: BrandingPublic;
}

// ── Common headers / cookies (informational) ─────────────────────────────────
export type CookieName =
  | 'operator_token'
  | 'inst_admin_token'
  | 'inst_teacher_token'
  | 'inst_student_token';

// ── Audit feed item (shared by operator Changes tab + per-student activity) ──
export interface AuditLogItem {
  _id: string;
  actorName: string;
  actorRole: ActorRole;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  impersonatedBy?: string | null;
  createdAt: string;
}
