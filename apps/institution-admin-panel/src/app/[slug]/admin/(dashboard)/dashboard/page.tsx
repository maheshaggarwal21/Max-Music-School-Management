"use client";
import { useEffect, useState } from "react";
import {
  CalendarCheck, CalendarClock, ClipboardCheck, GraduationCap, Inbox, KeyRound, Layers,
  TrendingUp, UserPlus, Users, Wallet,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  BlurFade, BorderBeam, CountUp, LineChart, StatsCard, StatusBadge, useBranding,
} from "@maxmusic/ui";
import { joinStatusLabel } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_DASHBOARD, ok } from "@/lib/mocks";
import type { AdminDashboardData, ApiResponse } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { QuickActions } from "@/components/quick-actions";
import { EmptyState } from "@/components/empty-state";
import { Skeleton, StatsRowSkeleton } from "@/components/skeletons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-07" → "Jul" · January gets the year ("Jan '26") to anchor the axis. */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const label = MONTHS[(m ?? 1) - 1] ?? key;
  return m === 1 ? `${label} '${String(y).slice(2)}` : label;
}

/** Attendance bars: brand when healthy, amber < 75%, red < 60%. */
function rateColor(rate: number): string {
  if (rate < 60) return "#ef4444";
  if (rate < 75) return "#f59e0b";
  return "var(--brand-primary)";
}

export default function DashboardPage() {
  const branding = useBranding();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/admin`;
  const [data, setData] = useState<AdminDashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<AdminDashboardData>>(adminPath("/dashboard")),
      ok(MOCK_DASHBOARD)
    ).then((r) => {
      if (!cancelled && r.data) setData(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const students = data?.stats.students;
  const newThisMonth =
    data?.enrollmentTrend[data.enrollmentTrend.length - 1]?.newStudents ?? 0;
  const trendData =
    data?.enrollmentTrend.map((p) => ({ ...p, label: monthLabel(p.month) })) ?? [];

  return (
    <PageShell
      title="Dashboard"
      subtitle={
        branding
          ? `${branding.schoolName} · at a glance`
          : "Your school at a glance"
      }
    >
      {/* Quick actions — core operations up front (A1) */}
      <QuickActions
        actions={[
          { label: "Add Student", hint: "File an enrollment request", href: `${base}/requests?new=1`, icon: UserPlus },
          { label: "Add Teacher", hint: "Onboard a teacher", href: `${base}/teachers?new=1`, icon: GraduationCap },
          { label: "Add Batch", hint: "Compose days × time × teacher", href: `${base}/batches?new=1`, icon: Layers },
          { label: "Requests", hint: "Approve pending enrollments", href: `${base}/requests`, icon: Inbox },
          { label: "Attendance", hint: "Mark & correct sessions", href: `${base}/attendance`, icon: CalendarCheck },
          { label: "Credentials", hint: "Reset forgotten passwords", href: `${base}/credentials`, icon: KeyRound },
        ]}
      />

      {/* Stats row */}
      {!data || !students ? (
        <StatsRowSkeleton />
      ) : (
        <BlurFade delay={0.1}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              label="Active Students"
              value={students.active}
              icon={Users}
              trend={`${students.trial} trial · ${students.activeSoon} starting soon · ${students.inactive} inactive`}
            />
            <StatsCard
              label="Teachers"
              value={data.stats.teachers.active}
              icon={GraduationCap}
              trend="active faculty"
            />
            <StatsCard
              label="Active Batches"
              value={data.stats.batches.active}
              icon={Layers}
              trend="running this term"
            />
            <StatsCard
              label="Fees This Month"
              value={
                <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                  <span className="text-[0.65em] font-semibold text-muted-foreground">₹</span>
                  <CountUp to={Math.round(data.stats.feesThisMonth / 100)} separator="," />
                </span>
              }
              icon={Wallet}
              trend="collected so far"
            />
          </div>
        </BlurFade>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Enrollment growth — most schools teach one instrument, so growth over
            time (not instrument mix) is the chart that earns its place here. */}
        <BlurFade delay={0.2}>
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={60} duration={10} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Enrollment Growth</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total students over the last 12 months
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                <TrendingUp className="h-3 w-3" />
                +{newThisMonth} this month
              </span>
            </div>
            <div className="mt-4">
              {!data ? (
                <Skeleton className="h-[240px] w-full" />
              ) : trendData.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No enrollments yet"
                  hint="Approve a request or add a student to see your growth curve."
                />
              ) : (
                <LineChart data={trendData} xKey="label" yKey="cumulative" height={240} />
              )}
            </div>
          </div>
        </BlurFade>

        {/* Attendance health by batch (last 30 days, worst first) */}
        <BlurFade delay={0.25}>
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={60} duration={11} />
            <h2 className="text-sm font-semibold">Attendance Health</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Present rate per batch · last 30 days · lowest first
            </p>
            <div className="mt-4 space-y-3.5">
              {!data ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : data.attendanceByBatch.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No attendance yet"
                  hint="Marked attendance from the last 30 days shows up here."
                />
              ) : (
                data.attendanceByBatch.map((b) => (
                  <div key={b.batchId}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <p className="truncate text-xs font-medium">{b.name}</p>
                      <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{b.rate}%</span>
                        {" · "}{b.present}/{b.total} present
                      </p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${b.rate}%`, backgroundColor: rateColor(b.rate) }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </BlurFade>
      </div>

      {/* Today's classes */}
      <BlurFade delay={0.3}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
          <BorderBeam size={60} duration={12} />
          <h2 className="text-sm font-semibold">Today&apos;s Classes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {!data ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : data.todaysClasses.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState
                  icon={CalendarClock}
                  title="No classes today"
                  hint="None of the active batches meet on this weekday."
                />
              </div>
            ) : (
              data.todaysClasses.map((b) => (
                <div
                  key={b._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.teacher ?? "Setting Phase"} · {b.studentCount}{" "}
                      student{b.studentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                    {b.time ?? "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </BlurFade>

      {/* Student lifecycle strip */}
      {students && (
        <BlurFade delay={0.4}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={50} duration={14} />
            <h2 className="text-sm font-semibold">Student Lifecycle</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {(
                [
                  ["trial", students.trial],
                  ["active_soon", students.activeSoon],
                  ["active", students.active],
                  ["inactive", students.inactive],
                ] as const
              ).map(([s, count]) => (
                <div key={s} className="flex items-center gap-2">
                  <StatusBadge status={s} />
                  <span className="text-sm font-bold">
                    <CountUp to={count} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {joinStatusLabel(s).toLowerCase()}
                  </span>
                </div>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {students.total} students total
              </span>
            </div>
          </div>
        </BlurFade>
      )}
    </PageShell>
  );
}
