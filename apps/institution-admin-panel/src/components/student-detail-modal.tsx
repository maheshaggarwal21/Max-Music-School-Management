"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Avatar, Modal, StatusBadge, cn } from "@maxmusic/ui";
import { formatCurrency, formatDate, formatPhone, joinStatusLabel } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_PAYMENTS, mockStudentActivity, mockStudentDetail, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, AuditLogItem, Paginated, PaymentRow, StudentDetail,
} from "@/lib/types";
import { ActivityFeed } from "./activity-feed";
import { Skeleton } from "./skeletons";

const TABS = ["Profile", "Payments", "Activity"] as const;
type Tab = (typeof TABS)[number];

const LIFECYCLE = ["trial", "active_soon", "active"] as const;

/** Visual joinStatus lifecycle: trial → active soon → active (inactive flagged). */
function StatusTimeline({ status }: { status: StudentDetail["joinStatus"] }) {
  const currentIdx = status === "inactive" ? LIFECYCLE.length : LIFECYCLE.indexOf(status);
  return (
    <div>
      <div className="flex items-center">
        {LIFECYCLE.map((step, i) => {
          const done = currentIdx > i;
          const current = currentIdx === i;
          return (
            <div key={step} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span className={cn("mx-1 h-px flex-1", done || current ? "bg-brand" : "bg-border")} />
              )}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                    done && "border-brand bg-brand text-brand-foreground",
                    current && "border-brand bg-brand/10 text-brand",
                    !done && !current && "border-border bg-card text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] font-medium uppercase tracking-wide",
                    current || done ? "text-brand" : "text-muted-foreground"
                  )}
                >
                  {joinStatusLabel(step)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {status === "inactive" && (
        <p className="mt-2 text-[11px] font-medium text-destructive">
          This student is currently inactive (validity expired or paused).
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value ?? "—"}</div>
    </div>
  );
}

/**
 * THE student detail popup: profile + lifecycle timeline + payments mini-table
 * + per-student activity feed (AuditLog entries).
 */
export function StudentDetailModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Profile");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[] | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setTab("Profile");
    setDetail(null);
    setActivity(null);
    setPayments(null);
    let cancelled = false;

    mockable(
      () => api.get<ApiResponse<StudentDetail>>(adminPath(`/students/${studentId}`)),
      ok(mockStudentDetail(studentId))
    ).then((r) => !cancelled && setDetail(r.data));

    mockable(
      () => api.get<ApiResponse<Paginated<AuditLogItem>>>(adminPath(`/students/${studentId}/activity`)),
      ok(paginate(mockStudentActivity(studentId)))
    ).then((r) => !cancelled && setActivity(r.data?.items ?? []));

    // Payments scoped to this student (mock filters the institution feed).
    mockable(
      () => api.get<ApiResponse<Paginated<PaymentRow>>>(adminPath(`/payments`)),
      ok(paginate(MOCK_PAYMENTS))
    ).then((r) => {
      if (cancelled) return;
      setPayments((r.data?.items ?? []).filter((p) => p.student._id === studentId));
    });

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <Modal
      open={!!studentId}
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <Avatar name={detail?.name ?? studentName ?? ""} size="md" />
          {detail?.name ?? studentName ?? "Student"}
        </span>
      }
      subtitle={
        detail ? (
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{detail.displayId}</span>
            <StatusBadge status={detail.joinStatus} />
            <StatusBadge status={detail.mode} />
            <StatusBadge status={detail.paymentStatus} />
          </span>
        ) : (
          "Loading profile…"
        )
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-muted/60 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              tab === t
                ? "bg-card text-brand shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="max-h-[55vh] overflow-y-auto pr-1">
        {tab === "Profile" &&
          (!detail ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <StatusTimeline status={detail.joinStatus} />

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Mobile" value={formatPhone(detail.mobile)} />
                <Field label="Email" value={detail.email ?? "—"} />
                <Field label="Instrument" value={detail.instrument ?? "—"} />
                <Field label="Class level" value={detail.classLevel?.name ?? "—"} />
                <Field label="Class type" value={detail.classType ?? "—"} />
                <Field label="Batch" value={detail.batch?.name ?? "Not assigned"} />
                <Field label="Teacher" value={detail.teacher?.name ?? "Not assigned"} />
                <Field
                  label="Schedule"
                  value={
                    detail.schedule.days
                      ? `${detail.schedule.days} · ${detail.schedule.time ?? ""}`
                      : "—"
                  }
                />
                <Field label="Category" value={<span className="capitalize">{detail.category}</span>} />
              </div>

              {/* Validity */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Validity
                </p>
                <p className="mt-1 text-sm">
                  {detail.validityStart
                    ? `${formatDate(detail.validityStart)} → ${formatDate(detail.validityEnd)} · ${detail.validityDays} days`
                    : "No validity window set"}
                </p>
              </div>

              {/* Financials & Admin */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                    Financials &amp; Admin
                  </p>
                  <StatusBadge status={detail.paymentStatus} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total fee</p>
                    <p className="mt-1 text-base font-bold">{formatCurrency(detail.feeTotal)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid</p>
                    <p className="mt-1 text-base font-bold text-brand">{formatCurrency(detail.paidAmount)}</p>
                    <p className="text-[11px] text-muted-foreground">{detail.paidClasses} classes</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg border p-3",
                      detail.remainingAmount > 0
                        ? "border-amber-500/30 bg-amber-500/[0.06]"
                        : "border-border bg-card"
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Remaining</p>
                    <p
                      className={cn(
                        "mt-1 text-base font-bold",
                        detail.remainingAmount > 0 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(detail.remainingAmount)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{detail.remainingAmount > 0 ? "left to pay" : "fully paid"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <span>Upcoming amount: <span className="font-medium text-foreground">{formatCurrency(detail.upcomingAmount)}</span></span>
                  <span>Upcoming classes: <span className="font-medium text-foreground">{detail.upcomingClasses}</span></span>
                </div>
                {detail.remarks && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Remarks</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{detail.remarks}</p>
                  </div>
                )}
              </div>

              {/* Attendance summary */}
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                  {detail.attendanceSummary.present} present
                </span>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
                  {detail.attendanceSummary.absent} absent
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  {detail.attendanceSummary.total} total
                </span>
              </div>
            </div>
          ))}

        {tab === "Payments" &&
          (!payments ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payments recorded for this student.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-brand">
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Period</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2">Paid at</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-b border-border/50">
                    <td className="py-2 pr-2 capitalize">{p.type}</td>
                    <td className="py-2 pr-2">{p.period ?? "—"}</td>
                    <td className="py-2 pr-2 font-medium">{formatCurrency(p.amount)}</td>
                    <td className="py-2 pr-2"><StatusBadge status={p.status} /></td>
                    <td className="py-2 text-xs text-muted-foreground">{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {tab === "Activity" &&
          (!activity ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ActivityFeed items={activity} />
          ))}
      </div>
    </Modal>
  );
}
