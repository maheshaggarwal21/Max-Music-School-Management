"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarOff,
  Hourglass,
  Music,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  CountUp,
  GradientText,
  ShinyText,
  SpotlightCard,
  StatsCard,
  StatusBadge,
  type StatusBadgeStatus,
} from "@maxmusic/ui";
import { formatDate, joinStatusLabel } from "@maxmusic/utils";

import { api, mockable, studentPath } from "@/lib/api";
import {
  MOCK_CLASSES,
  MOCK_CLASS_BALANCE,
  MOCK_DASHBOARD,
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

export default function DashboardPage() {
  const { student } = useStudent();
  const [dash, setDash] = useState<StudentDashboard | null>(null);
  const [history, setHistory] = useState<ClassItem[]>([]);
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
      // PENDING CONTRACT — class balance is mock-only until Dev A adds it.
      mockable<ClassBalance | null>(() => Promise.resolve(null), MOCK_CLASS_BALANCE),
    ]).then(([d, c, b]) => {
      if (cancelled) return;
      setDash(d);
      setHistory(c.items);
      setBalance(b);
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

  if (!student) return null;

  const joinBadge: StatusBadgeStatus | null = JOIN_BADGES.includes(student.joinStatus)
    ? (student.joinStatus as StatusBadgeStatus)
    : null;

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

      {/* Next class highlight */}
      <BlurFade delay={0.15}>
        {dash?.upcomingClass ? (
          <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5">
            <BorderBeam size={70} duration={6} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="rounded-2xl bg-brand/10 p-4"
                  style={{ boxShadow: "var(--glow-primary-sm)" }}
                >
                  <Music className="h-6 w-6 text-brand" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Your next class
                  </p>
                  <GradientText className="mt-1 text-xl font-bold">
                    {dash.upcomingClass.batchName}
                  </GradientText>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDate(dash.upcomingClass.date)} · {dash.upcomingClass.time}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-brand/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand">
                {relativeDay(dash.upcomingClass.date)}
              </span>
            </div>
          </SpotlightCard>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No classes yet"
            message="Your schedule appears here once enrolled. Your school will set up your batch shortly."
          />
        )}
      </BlurFade>

      {/* Stats row */}
      <BlurFade delay={0.25}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            label="Attendance"
            value={dash?.attendance.percent ?? 0}
            icon={TrendingUp}
            trend={
              dash
                ? `${dash.attendance.present} of ${dash.attendance.total} classes attended`
                : undefined
            }
          />
          <StatsCard
            label="Classes Remaining"
            value={classesRemaining ?? "—"}
            icon={Hourglass}
            trend={balance ? `of ${balance.paidClasses} purchased` : undefined}
          />
          <StatsCard
            label="Validity Days Left"
            value={validityDaysLeft ?? "—"}
            icon={CalendarCheck2}
            trend={
              student.validityEnd ? `until ${formatDate(student.validityEnd)}` : undefined
            }
          />
          <StatsCard
            label="Weekly Schedule"
            value={dash?.credentials.schedule ?? "—"}
            icon={CalendarClock}
            trend={dash?.credentials.sessionSlot ?? undefined}
          />
        </div>
      </BlurFade>

      {/* Class balance + recent attendance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BlurFade delay={0.35} className="h-full">
          <SpotlightCard className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6">
            <BorderBeam size={40} duration={12} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Class balance
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              {balance ? (
                <>
                  <ProgressRing
                    value={balance.paidClasses - balance.classesUsed}
                    max={balance.paidClasses}
                    centerValue={balance.paidClasses - balance.classesUsed}
                    label="classes left"
                  />
                  <div className="min-w-0 flex-1 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Purchased</span>
                      <span className="font-semibold">
                        <CountUp to={balance.paidClasses} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Used so far</span>
                      <span className="font-semibold">
                        <CountUp to={balance.classesUsed} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Valid until</span>
                      <span className="font-semibold">{formatDate(balance.validityEnd)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your class balance appears here once your plan is active.
                </p>
              )}
            </div>
          </SpotlightCard>
        </BlurFade>

        <BlurFade delay={0.45} className="h-full">
          <SpotlightCard className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6">
            <BorderBeam size={40} duration={12} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent attendance — last {Math.min(history.length, 10)} sessions
            </p>
            <div className="mt-5">
              {history.length > 0 ? (
                <AttendanceDots sessions={history} count={10} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No sessions yet — your attendance appears here after your first class.
                </p>
              )}
            </div>
          </SpotlightCard>
        </BlurFade>
      </div>
    </div>
  );
}
