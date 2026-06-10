"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Music } from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  GradientText,
  ShinyText,
  SpotlightCard,
  cn,
} from "@maxmusic/ui";
import { formatDate } from "@maxmusic/utils";

import { api, mockable, studentPath } from "@/lib/api";
import { MOCK_TIMETABLE } from "@/lib/mocks";
import type { ApiResponse, ClassItem } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** Monday of the week containing `d` (+ offset weeks). */
function mondayOf(d: Date, offsetWeeks = 0): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0 = Sun
  out.setDate(out.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  return out;
}

export default function TimetablePage() {
  const [timetable, setTimetable] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () =>
        api
          .get<ApiResponse<ClassItem[]>>(studentPath("/timetable"))
          .then((r) => r.data!),
      MOCK_TIMETABLE
    )
      .then((items) => {
        if (!cancelled) setTimetable(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, ClassItem>();
    for (const item of timetable) m.set(item.date.slice(0, 10), item);
    return m;
  }, [timetable]);

  // Recurring weekly slots derived from the student's dayPattern + timeSlot
  // (inferred from the upcoming timetable entries).
  const recurring = useMemo(() => {
    const m = new Map<number, { time: string; batchName: string }>();
    for (const item of timetable) {
      const wd = new Date(`${item.date.slice(0, 10)}T00:00:00`).getDay();
      if (!m.has(wd)) m.set(wd, { time: item.time, batchName: item.batchName });
    }
    return m;
  }, [timetable]);

  const upcomingHolidays = useMemo(
    () => timetable.filter((t) => t.status === "holiday"),
    [timetable]
  );

  const todayKey = toKey(new Date());
  const monday = mondayOf(new Date(), weekOffset);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const weekLabel = `${formatDate(week[0])} – ${formatDate(week[6])}`;

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <GradientText className="text-2xl font-bold">Timetable</GradientText>
            <ShinyText text="Your weekly class schedule" speed={6} className="mt-1 text-sm" />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-md p-1.5 transition-all hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-all hover:bg-muted",
                weekOffset === 0 && "text-brand"
              )}
            >
              {weekOffset === 0 ? "This week" : weekLabel}
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-md p-1.5 transition-all hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </BlurFade>

      {loading && <div className="h-64 animate-pulse rounded-2xl bg-muted/60" />}

      {!loading && timetable.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No classes yet"
          message="Your schedule appears here once enrolled. Your school will assign your weekly slot soon."
        />
      )}

      {!loading && timetable.length > 0 && (
        <BlurFade delay={0.15}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {week.map((d, i) => {
              const key = toKey(d);
              const isToday = key === todayKey;
              const entry = byDate.get(key);
              const slot = entry ?? null;
              const recurringSlot = recurring.get(d.getDay()) ?? null;
              const scheduled = slot ?? recurringSlot;
              const isHoliday = entry?.status === "holiday";

              return (
                <SpotlightCard
                  key={key}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-300",
                    isToday
                      ? "border-brand/60 shadow-[var(--glow-primary-sm)]"
                      : "border-border"
                  )}
                >
                  {isToday && <BorderBeam size={40} duration={8} />}
                  <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-1">
                    <div>
                      <p
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-wider",
                          isToday ? "text-brand" : "text-muted-foreground"
                        )}
                      >
                        {DAY_LABELS[i]}
                        {isToday && " · Today"}
                      </p>
                      <p className="text-lg font-bold">{d.getDate()}</p>
                    </div>

                    <div className="lg:mt-2 lg:w-full">
                      {scheduled ? (
                        <div
                          className={cn(
                            "rounded-xl bg-brand/10 px-3 py-2",
                            isHoliday && "bg-amber-400/10"
                          )}
                        >
                          <p
                            className={cn(
                              "flex items-center gap-1.5 text-xs font-semibold",
                              isHoliday
                                ? "text-amber-500 line-through decoration-2"
                                : "text-brand"
                            )}
                          >
                            <Music className="h-3 w-3 shrink-0" />
                            {scheduled.time}
                          </p>
                          {isHoliday && (
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                              Holiday · credited
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60">No class</p>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </BlurFade>
      )}

      {!loading && upcomingHolidays.length > 0 && (
        <BlurFade delay={0.3}>
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-5 py-4">
            <BorderBeam size={50} duration={9} />
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-400/15 p-2">
                <CalendarOff className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Upcoming holidays</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {upcomingHolidays
                    .map((h) => formatDate(h.date))
                    .join(" · ")}{" "}
                  — these classes are credited back to you automatically.
                </p>
              </div>
            </div>
          </div>
        </BlurFade>
      )}
    </div>
  );
}
