"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock, GraduationCap, Layers, Users, Wallet,
} from "lucide-react";
import {
  BarChart, BlurFade, BorderBeam, CountUp, StatsCard, StatusBadge, useBranding,
} from "@maxmusic/ui";
import { formatCurrency, joinStatusLabel } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_BATCHES, MOCK_DAY_PATTERNS, MOCK_PAYMENTS, MOCK_STUDENTS, MOCK_TEACHERS,
  ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, Paginated, PaymentRow, StudentRow, TeacherRow,
} from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { Skeleton, StatsRowSkeleton } from "@/components/skeletons";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

interface DashboardData {
  students: StudentRow[];
  teachers: TeacherRow[];
  batches: BatchRow[];
  payments: PaymentRow[];
}

export default function DashboardPage() {
  const branding = useBranding();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dashboard aggregates are computed from the contract list endpoints —
    // no invented "/dashboard" admin contract exists in CONTRACTS.md.
    Promise.all([
      mockable(
        () => api.get<ApiResponse<Paginated<StudentRow>>>(adminPath("/students?page=1&limit=100")),
        ok(paginate(MOCK_STUDENTS))
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<TeacherRow>>>(adminPath("/teachers?page=1&limit=100")),
        ok(paginate(MOCK_TEACHERS))
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<BatchRow>>>(adminPath("/batches?page=1&limit=100")),
        ok(paginate(MOCK_BATCHES))
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<PaymentRow>>>(adminPath("/payments?page=1&limit=100")),
        ok(paginate(MOCK_PAYMENTS))
      ),
    ]).then(([s, t, b, p]) => {
      if (cancelled) return;
      setData({
        students: s.data?.items ?? [],
        teachers: t.data?.items ?? [],
        batches: b.data?.items ?? [],
        payments: p.data?.items ?? [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const byStatus = { trial: 0, active_soon: 0, active: 0, inactive: 0 };
    for (const s of data.students) byStatus[s.joinStatus] += 1;

    const now = new Date();
    const feesThisMonthPaise = data.payments
      .filter((p) => {
        if (!p.paidAt) return false;
        const d = new Date(p.paidAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const byInstrument = new Map<string, number>();
    for (const s of data.students) {
      const key = s.instrument ?? "Other";
      byInstrument.set(key, (byInstrument.get(key) ?? 0) + 1);
    }
    const chart = Array.from(byInstrument.entries())
      .map(([instrument, students]) => ({ instrument, students }))
      .sort((a, b) => b.students - a.students);

    // Today's classes: active batches whose day pattern includes today.
    const todayKey = WEEKDAY_KEYS[now.getDay()];
    const dayPatternDays = new Map(MOCK_DAY_PATTERNS.map((p) => [p._id, p.days]));
    const todaysClasses = data.batches
      .filter((b) => b.status === "active" && b.dayPattern)
      .filter((b) => (dayPatternDays.get(b.dayPattern!._id) ?? []).includes(todayKey))
      .sort((a, b) => (a.timeSlot?.label ?? "").localeCompare(b.timeSlot?.label ?? ""));

    return {
      byStatus,
      feesThisMonthRupees: Math.round(feesThisMonthPaise / 100),
      activeTeachers: data.teachers.filter((t) => t.status === "active").length,
      activeBatches: data.batches.filter((b) => b.status === "active").length,
      chart,
      todaysClasses,
    };
  }, [data]);

  return (
    <PageShell
      title="Dashboard"
      subtitle={
        branding
          ? `${branding.schoolName} · at a glance`
          : "Your school at a glance"
      }
    >
      {/* Stats row */}
      {!stats ? (
        <StatsRowSkeleton />
      ) : (
        <BlurFade delay={0.1}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              label="Active Students"
              value={stats.byStatus.active}
              icon={Users}
              trend={`${stats.byStatus.trial} trial · ${stats.byStatus.active_soon} starting soon · ${stats.byStatus.inactive} inactive`}
            />
            <StatsCard
              label="Teachers"
              value={stats.activeTeachers}
              icon={GraduationCap}
              trend="active faculty"
            />
            <StatsCard
              label="Active Batches"
              value={stats.activeBatches}
              icon={Layers}
              trend="running this term"
            />
            <StatsCard
              label="Fees This Month"
              value={
                <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                  <span className="text-[0.65em] font-semibold text-muted-foreground">₹</span>
                  <CountUp to={stats.feesThisMonthRupees} separator="," />
                </span>
              }
              icon={Wallet}
              trend="collected so far"
            />
          </div>
        </BlurFade>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Enrollments by instrument */}
        <BlurFade delay={0.2} className="xl:col-span-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={60} duration={10} />
            <h2 className="text-sm font-semibold">Enrollments by Instrument</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Current students per instrument
            </p>
            <div className="mt-4">
              {!stats ? (
                <Skeleton className="h-[260px] w-full" />
              ) : stats.chart.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No enrollments yet"
                  hint="Approve a request or add a student to see this chart."
                />
              ) : (
                <BarChart data={stats.chart} xKey="instrument" yKey="students" height={260} />
              )}
            </div>
          </div>
        </BlurFade>

        {/* Today's classes */}
        <BlurFade delay={0.3} className="xl:col-span-2">
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={60} duration={12} />
            <h2 className="text-sm font-semibold">Today&apos;s Classes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </p>
            <div className="mt-4 space-y-3">
              {!stats ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : stats.todaysClasses.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No classes today"
                  hint="None of the active batches meet on this weekday."
                />
              ) : (
                stats.todaysClasses.map((b) => (
                  <div
                    key={b._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.teacher?.name ?? "Setting Phase"} · {b.studentCount}{" "}
                        student{b.studentCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                      {b.timeSlot?.label ?? "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </BlurFade>
      </div>

      {/* Student lifecycle strip */}
      {stats && (
        <BlurFade delay={0.4}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={50} duration={14} />
            <h2 className="text-sm font-semibold">Student Lifecycle</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {(["trial", "active_soon", "active", "inactive"] as const).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <StatusBadge status={s} />
                  <span className="text-sm font-bold">
                    <CountUp to={stats.byStatus[s]} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {joinStatusLabel(s).toLowerCase()}
                  </span>
                </div>
              ))}
              {data && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.students.length} students total ·{" "}
                  {formatCurrency(
                    data.payments
                      .filter((p) => p.status === "overdue")
                      .reduce((sum, p) => sum + p.amount, 0)
                  )}{" "}
                  overdue
                </span>
              )}
            </div>
          </div>
        </BlurFade>
      )}
    </PageShell>
  );
}
