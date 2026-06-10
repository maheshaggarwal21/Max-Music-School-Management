"use client";
import { useEffect, useState } from "react";
import { Modal, StatusBadge, useBranding } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { localAuditEntry, mockStudentActivity, mockStudentDetail, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, AuditLogItem, Paginated, StudentDetail } from "@/lib/types";
import { ActivityRail } from "./activity-rail";
import { StudentEditForm } from "./student-edit-form";
import { Skeleton } from "./skeletons";

// THE single big "Edit Student" dialog: full edit form on the left, the live
// node-style Recent Activity rail on the right. Saving instantly pushes each
// field change into the rail.

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
  const branding = useBranding();
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
      title={`Edit ${detail?.name ?? studentName ?? "Student"}`}
      subtitle={
        detail ? (
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{detail.displayId}</span>
            {branding && <span className="text-xs">· {branding.schoolName}</span>}
            <StatusBadge status={detail.joinStatus} />
          </span>
        ) : (
          "Loading…"
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Left: the full edit form */}
        <div className="max-h-[62vh] overflow-y-auto pr-1">
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
        <div className="max-h-[62vh] border-border lg:border-l lg:pl-5">
          <ActivityRail items={activity} className="h-full" />
        </div>
      </div>
    </Modal>
  );
}
