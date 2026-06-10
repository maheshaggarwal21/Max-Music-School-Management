"use client";
// Teacher dashboard — today's timeline, quick stats, next-class highlight.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Clock,
  Music2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  GradientText,
  ShinyText,
  StatsCard,
  StatusBadge,
  Button,
} from "@maxmusic/ui";
import { api, mockable, teacherPath } from "@/lib/api";
import { MOCK_BATCHES_RESPONSE, MOCK_ME } from "@/lib/mocks";
import type { ApiResponse, BatchRow, TeacherMeData } from "@/lib/types";
import {
  classesOn,
  classesPerWeek,
  nextClass,
  weekdayLabel,
} from "@/lib/schedule";
import { CardListSkeleton, StatsSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [firstName, setFirstName] = useState("");
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<BatchRow[]>>(teacherPath("/batches")),
      MOCK_BATCHES_RESPONSE
    ).then((res) => {
      if (!cancelled) setBatches(res.data ?? []);
    });
    mockable(
      () => api.get<ApiResponse<TeacherMeData>>(teacherPath("/me")),
      MOCK_ME
    ).then((res) => {
      if (!cancelled && res.data) {
        setFirstName(res.data.teacher.name.split(" ")[0] ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const todays = useMemo(() => (batches ? classesOn(batches, now) : []), [batches, now]);
  const upNext = useMemo(() => (batches ? nextClass(batches, now) : null), [batches, now]);
  const studentsTaught = useMemo(
    () => (batches ?? []).reduce((sum, b) => sum + b.studentCount, 0),
    [batches]
  );
  const myBatchCount = useMemo(
    () => (batches ?? []).filter((b) => b.status === "active" || b.status === "setting").length,
    [batches]
  );

  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      {/* Header */}
      <BlurFade delay={0}>
        <div>
          <GradientText className="!mx-0 !justify-start text-2xl font-bold">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </GradientText>
          <ShinyText
            text={`${weekdayLabel(now)} · ${todays.length} ${todays.length === 1 ? "class" : "classes"} today`}
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.1}>
        {batches === null ? (
          <StatsSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard label="My Batches" value={myBatchCount} icon={Music2} />
            <StatsCard label="Students Taught" value={studentsTaught} icon={Users} />
            <StatsCard
              label="Classes This Week"
              value={classesPerWeek(batches)}
              icon={CalendarClock}
            />
          </div>
        )}
      </BlurFade>

      {/* Next class highlight */}
      {upNext && (
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-brand/5 p-5">
            <BorderBeam size={60} duration={8} />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15">
                  <Sparkles className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                    {upNext.isToday ? "Next class today" : `Next class · ${weekdayLabel(upNext.date)}`}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold">
                    {upNext.batch.instrument?.name ?? "Class"} · {upNext.batch.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {upNext.batch.timeSlot?.label ?? "—"} · {upNext.batch.studentCount} students
                  </p>
                </div>
              </div>
              <Button asChild variant="brand" className="group rounded-full">
                <Link href={`/${slug}/teacher/attendance`}>
                  Mark attendance
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Today's timeline */}
      <BlurFade delay={0.3}>
        <div className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4" /> Today&apos;s classes
          </h2>

          {batches === null ? (
            <CardListSkeleton count={3} />
          ) : todays.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No classes scheduled today"
              description="Enjoy the quiet — your next class is shown above when one is coming up."
            />
          ) : (
            <ol className="relative flex flex-col gap-3 border-l border-border pl-5">
              {todays.map((b, i) => (
                <BlurFade key={b._id} delay={0.35 + i * 0.08} inView>
                  <li className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
                    <BorderBeam size={40} duration={12} delay={i * 2} />
                    <span className="absolute -left-[25.5px] top-6 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_6px_var(--brand-primary)]" />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {b.timeSlot?.label ?? "Time TBD"}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {b.instrument?.name ?? "—"} · {b.name} · slot{" "}
                          {b.timeSlot?.label?.split("–")[0]?.trim() ?? "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> {b.studentCount}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  </li>
                </BlurFade>
              ))}
            </ol>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
