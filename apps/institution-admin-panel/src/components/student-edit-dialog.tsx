"use client";
import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Modal, StatusBadge } from "@maxmusic/ui";
import { formatPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { localAuditEntry, mockStudentActivity, mockStudentDetail, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, AuditLogItem, Paginated, StudentDetail } from "@/lib/types";
import { ActivityRail } from "./activity-rail";
import { StudentEditForm } from "./student-edit-form";
import { Skeleton } from "./skeletons";

// THE single big "Edit Student" dialog: rich student header, full edit form on
// the left, and the live node-style Recent Activity rail on the right. Saving
// instantly pushes each field change into the rail.

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex flex-col items-center px-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${className ?? ""}`}>{value}</span>
    </div>
  );
}

function EditHeader({ detail }: { detail: StudentDetail }) {
  const att = detail.attendanceSummary;
  const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
  const wa = detail.mobile.replace(/\D/g, "");
  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={detail.name} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-bold">{detail.name}</h2>
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{detail.displayId}</span>
            <StatusBadge status={detail.joinStatus} />
            <StatusBadge status={detail.paymentStatus} />
            {detail.accountStatus !== "active" && <StatusBadge status={detail.accountStatus} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <button type="button" onClick={() => copy(detail.mobile, "Mobile")} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
              <Phone className="h-3 w-3" /> {formatPhone(detail.mobile)} <Copy className="h-3 w-3 opacity-50" />
            </button>
            {detail.email && (
              <button type="button" onClick={() => copy(detail.email!, "Email")} className="inline-flex max-w-[220px] items-center gap-1 transition-colors hover:text-foreground">
                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{detail.email}</span> <Copy className="h-3 w-3 shrink-0 opacity-50" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 px-2 py-1.5">
          <span className="px-1.5 text-sm font-bold tabular-nums text-brand">{pct}%</span>
          <span className="h-7 w-px bg-border" />
          <Stat label="Total" value={att.total} />
          <Stat label="Present" value={att.present} className="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Absent" value={att.absent} className="text-destructive" />
        </div>
        <a
          href={`tel:${detail.mobile}`}
          aria-label="Call"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-brand transition-colors hover:bg-brand/10"
        >
          <Phone className="h-4 w-4" />
        </a>
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

export function StudentEditDialog({
  studentId,
  studentName,
  onClose,
  onUpdated,
}: {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
  onUpdated?: (updated: StudentDetail) => void;
}) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    if (!studentId) return;
    setDetail(null);
    setActivity([]);
    let cancelled = false;

    mockable(
      () => api.get<ApiResponse<StudentDetail>>(adminPath(`/students/${studentId}`)),
      ok(mockStudentDetail(studentId))
    ).then((r) => !cancelled && setDetail(r.data));

    mockable(
      () => api.get<ApiResponse<Paginated<AuditLogItem>>>(adminPath(`/students/${studentId}/activity`)),
      ok(paginate(mockStudentActivity(studentId)))
    ).then((r) => !cancelled && setActivity(r.data?.items ?? []));

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <Modal
      open={!!studentId}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      title={detail ? <EditHeader detail={detail} /> : `Edit ${studentName ?? "Student"}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Left: the full edit form */}
        <div className="max-h-[62vh] overflow-y-auto pr-1 pb-1">
          {!detail ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <StudentEditForm
              detail={detail}
              onSaved={(updated, changes, action) => {
                setDetail(updated);
                setActivity((prev) => [
                  localAuditEntry({
                    action,
                    entityType: "Student",
                    entityId: updated._id,
                    entityLabel: `Student: ${updated.name}`,
                    changes,
                  }),
                  ...prev,
                ]);
                onUpdated?.(updated);
              }}
            />
          )}
        </div>

        {/* Right: live activity rail */}
        <div className="max-h-[62vh] overflow-y-auto border-border lg:border-l lg:pl-5">
          <ActivityRail items={activity} className="h-full" />
        </div>
      </div>
    </Modal>
  );
}
