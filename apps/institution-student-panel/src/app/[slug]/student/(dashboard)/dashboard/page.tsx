"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarOff,
  Clock,
  Music,
  Sparkles,
  Video,
} from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  CountUp,
  GradientText,
  ShinyText,
  SpotlightCard,
  StatusBadge,
  cn,
  type StatusBadgeStatus,
} from "@maxmusic/ui";
import { formatDate, joinStatusLabel } from "@maxmusic/utils";

import { api, getInstSlug, mockable, MOCKS_ENABLED, studentPath } from "@/lib/api";
import {
  MOCK_CLASSES,
  MOCK_CLASS_BALANCE,
  MOCK_DASHBOARD,
  MOCK_TIMETABLE,
  type ClassBalance,
} from "@/lib/mocks";
import type { ApiResponse, ClassItem, Paginated, StudentDashboard } from "@/lib/types";
import { useStudent } from "@/components/student-provider";
import { ProgressRing } from "@/components/progress-ring";
import { AttendanceDots } from "@/components/attendance-dots";
import { EmptyState } from "@/components/empty-state";

const JOIN_BADGES: ReadonlyArray<string> = ["trial", "active_soon", "active", "inactive"];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeDay(iso: string): string {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

/** Calendar-chip parts for a timetable row (e.g. SAT / 13 / Jun 2026). */
function dateChip(iso: string): { weekday: string; day: number; month: string } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: d.getDate(),
    month: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DashboardPage() {
  const { student } = useStudent();
  const [dash, setDash] = useState<StudentDashboard | null>(null);
  const [history, setHistory] = useState<ClassItem[]>([]);
  const [timetable, setTimetable] = useState<ClassItem[]>([]);
  const [balance, setBalance] = useState<ClassBalance | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockable(
        () =>
          api
            .get<ApiResponse<StudentDashboard>>(studentPath("/dashboard"))
            .then((r) => r.data!),
        MOCK_DASHBOARD
      ),
      mockable(
        () =>
          api
            .get<ApiResponse<Paginated<ClassItem>>>(studentPath("/classes?page=1&limit=10"))
            .then((r) => r.data!),
        MOCK_CLASSES
      ),
      // The live /dashboard payload omits the timetable — fetch it directly so
      // the schedule list works in live mode (not just from the mock).
      mockable(
        () =>
          api.get<ApiResponse<ClassItem[]>>(studentPath("/timetable")).then((r) => r.data!),
        MOCK_TIMETABLE
      ),
    ]).then(([d, c, t]) => {
      if (cancelled) return;
      setDash(d);
      setHistory(c.items);
      setTimetable(t ?? []);
      // A5 — class balance now derives live from the dashboard payload.
      setBalance(
        d.validity && d.validity.paidClasses > 0
          ? {
              paidClasses: d.validity.paidClasses,
              classesUsed: d.attendance.total,
              validityStart: d.validity.start ?? "",
              validityEnd: d.validity.end ?? "",
            }
          : MOCKS_ENABLED
            ? MOCK_CLASS_BALANCE
            : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const classesRemaining = balance ? balance.paidClasses - balance.classesUsed : null;
  const validityDaysLeft = useMemo(() => {
    if (!student?.validityEnd) return null;
    const end = new Date(`${student.validityEnd.slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86400000));
  }, [student?.validityEnd]);

  // Upcoming sessions for the dashboard Time Table list — today onward only,
  // soonest first (the /timetable window spans last week → +5 weeks).
  const upcoming = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return timetable
      .filter(
        (t) =>
          t.date.slice(0, 10) >= todayKey &&
          (t.status === "upcoming" || t.status === "holiday")
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [timetable]);

  if (!student) return null;

  const joinBadge: StatusBadgeStatus | null = JOIN_BADGES.includes(student.joinStatus)
    ? (student.joinStatus as StatusBadgeStatus)
    : null;

  const next = dash?.upcomingClass ?? null;

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      {/* Hero greeting */}
      <BlurFade delay={0}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <GradientText className="text-2xl font-bold md:text-3xl">
                {`${greeting()}, ${student.name.split(" ")[0]}`}
              </GradientText>
              {joinBadge && <StatusBadge status={joinBadge} />}
            </div>
            <ShinyText
              text={`${student.instrument ?? "Music"} student · ${student.displayId}`}
              speed={6}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      </BlurFade>

      {/* Holiday notice */}
      {dash?.holidayNotice && (
        <BlurFade delay={0.1}>
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-5 py-4 backdrop-blur-md">
            <BorderBeam size={60} duration={7} />
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-400/15 p-2">
                <CalendarOff className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Holiday notice</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{dash.holidayNotice}</p>
              </div>
            </div>
          </div>
        </BlurFade>
      )}

      {/* ── Two-column workspace: schedule (main) + student details (sidebar) ── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ───────────────────────── MAIN COLUMN ───────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Upcoming-class hero banner */}
          <BlurFade delay={0.15}>
            {next ? (
              <div
                className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-primary-light), var(--brand-primary) 55%, var(--brand-primary-deep))",
                  boxShadow: "var(--glow-primary-lg)",
                }}
              >
                {/* decorative orbs */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white/15 p-3.5 backdrop-blur-sm">
                      <Music className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                        Upcoming class
                      </p>
                      <p className="mt-1.5 text-xl font-bold leading-snug">
                        {next.batchName}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-white/90">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDate(next.date)}
                        </span>
                        <span className="text-white/50">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {next.time}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {next.meetingUrl && (
                      <a
                        href={next.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-bold uppercase tracking-wider text-brand shadow-sm transition-transform hover:scale-[1.04]"
                      >
                        <Video className="h-4 w-4" />
                        Join class
                      </a>
                    )}
                    <span className="rounded-full bg-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                      {relativeDay(next.date)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No classes yet"
                message="Your schedule appears here once enrolled. Your school will set up your batch shortly."
              />
            )}
          </BlurFade>

          {/* Time Table list */}
          <BlurFade delay={0.25}>
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6">
              <BorderBeam size={50} duration={11} />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-brand/10 p-1.5">
                    <CalendarClock className="h-4 w-4 text-brand" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Time table · upcoming classes
                  </p>
                </div>
                <Link
                  href={`/${getInstSlug()}/student/timetable`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition-opacity hover:opacity-80"
                >
                  Full timetable
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {upcoming.length > 0 ? (
                  upcoming.slice(0, 7).map((item, i) => {
                    const chip = dateChip(item.date);
                    const isHoliday = item.status === "holiday";
                    const isNext =
                      !!next && next.date.slice(0, 10) === item.date.slice(0, 10);
                    return (
                      <div
                        key={`${item.date}-${i}`}
                        className={cn(
                          "group flex items-center gap-4 rounded-xl border bg-background/60 px-3 py-2.5 transition-all duration-200 hover:border-brand/40 hover:bg-brand/[0.04]",
                          isNext ? "border-brand/50" : "border-border"
                        )}
                      >
                        {/* date chip */}
                        <div
                          className={cn(
                            "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center",
                            isNext
                              ? "border-brand/40 bg-brand/10"
                              : "border-border bg-muted/40"
                          )}
                        >
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase tracking-wider",
                              isNext ? "text-brand" : "text-muted-foreground"
                            )}
                          >
                            {chip.weekday}
                          </span>
                          <span className="text-lg font-bold leading-none">{chip.day}</span>
                        </div>

                        {/* details */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm font-semibold",
                              isHoliday && "text-amber-500 line-through decoration-2"
                            )}
                          >
                            {item.batchName}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {chip.month} · {item.time}
                          </p>
                        </div>

                        {/* right action / status */}
                        {isHoliday ? (
                          <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                            Holiday · credited
                          </span>
                        ) : isNext && next?.meetingUrl ? (
                          <a
                            href={next.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-transform hover:scale-[1.04]"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Join
                          </a>
                        ) : (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                              isNext
                                ? "bg-brand/10 text-brand"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {relativeDay(item.date)}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No upcoming classes scheduled yet — they appear here once your batch is set.
                  </p>
                )}
              </div>
            </SpotlightCard>
          </BlurFade>
        </div>

        {/* ───────────────────────── SIDEBAR ───────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Stat pills */}
          <BlurFade delay={0.2}>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-card px-2 py-3 text-center">
                <p className="text-xl font-bold leading-none text-brand">
                  <CountUp to={dash?.attendance.percent ?? 0} />%
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Attendance
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-2 py-3 text-center">
                <p className="text-xl font-bold leading-none">
                  {dash ? (
                    <>
                      <CountUp to={dash.attendance.present} />
                      <span className="text-muted-foreground">
                        /{dash.validity.paidClasses || 0}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Progress
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-2 py-3 text-center">
                <p className="text-sm font-bold leading-none">
                  {joinStatusLabel(student.joinStatus)}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
              </div>
            </div>
          </BlurFade>

          {/* Profile + attendance + credentials card */}
          <BlurFade delay={0.3} className="h-full">
            <SpotlightCard className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5">
              <BorderBeam size={40} duration={12} />

              {/* Profile header */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--brand-primary-light), var(--brand-primary-deep))",
                  }}
                >
                  {initials(student.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{student.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {student.instrument && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                        {student.instrument}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent attendance */}
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent attendance
                </p>
                <div className="mt-3">
                  {history.length > 0 ? (
                    <AttendanceDots sessions={history} count={10} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No sessions yet — appears after your first class.
                    </p>
                  )}
                </div>
              </div>

              {/* Class balance */}
              {balance && (
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
                  <ProgressRing
                    value={balance.paidClasses - balance.classesUsed}
                    max={balance.paidClasses}
                    size={92}
                    stroke={8}
                    centerValue={balance.paidClasses - balance.classesUsed}
                    label="left"
                  />
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Purchased</span>
                      <span className="font-semibold">
                        <CountUp to={balance.paidClasses} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Used</span>
                      <span className="font-semibold">
                        <CountUp to={balance.classesUsed} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-semibold text-brand">
                        <CountUp to={classesRemaining ?? 0} />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Student details table */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Student details
                </p>
                <dl className="mt-3 divide-y divide-border/70 text-sm">
                  <DetailRow label="Registration ID">
                    <span className="font-mono font-semibold">{student.displayId}</span>
                  </DetailRow>
                  <DetailRow label="Weekly schedule">
                    {dash?.credentials.schedule ?? "—"}
                  </DetailRow>
                  <DetailRow label="Session slot">
                    {dash?.credentials.sessionSlot ?? "—"}
                  </DetailRow>
                  <DetailRow label="Course start">
                    {dash?.validity.start ? formatDate(dash.validity.start) : "—"}
                  </DetailRow>
                  <DetailRow label="Valid until">
                    {dash?.validity.end ? formatDate(dash.validity.end) : "—"}
                  </DetailRow>
                  <DetailRow label="Validity left">
                    {validityDaysLeft != null ? `${validityDaysLeft} days` : "—"}
                  </DetailRow>
                  <DetailRow label="Plan length">
                    <span className="text-brand">
                      {dash?.validity.days ? `${dash.validity.days} days plan` : "—"}
                    </span>
                  </DetailRow>
                  <DetailRow label="Total sessions">
                    <span className="text-brand">
                      {dash && dash.validity.paidClasses > 0
                        ? `${dash.validity.paidClasses} classes`
                        : "—"}
                    </span>
                  </DetailRow>
                </dl>
              </div>
            </SpotlightCard>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}

/** Label-left / value-right row used inside the student-details table. */
function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-sm font-semibold">{children}</dd>
    </div>
  );
}
