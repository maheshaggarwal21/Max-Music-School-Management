"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Music } from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  GradientText,
  ShinyText,
  cn,
} from "@maxmusic/ui";

import { api, mockable, studentPath } from "@/lib/api";
import { MOCK_CLASSES } from "@/lib/mocks";
import type { ApiResponse, ClassItem, Paginated } from "@/lib/types";
import { ClassStatusBadge, type ClassStatus } from "@/components/class-status-badge";
import { EmptyState } from "@/components/empty-state";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthGroup {
  key: string; // "2026-06"
  label: string; // "June 2026"
  items: ClassItem[];
  present: number;
  absent: number;
  holidays: number;
}

function groupByMonth(items: ClassItem[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    let group = map.get(key);
    if (!group) {
      const [y, m] = key.split("-");
      group = {
        key,
        label: `${MONTH_NAMES[Number(m) - 1]} ${y}`,
        items: [],
        present: 0,
        absent: 0,
        holidays: 0,
      };
      map.set(key, group);
    }
    group.items.push(item);
    if (item.status === "present") group.present += 1;
    if (item.status === "absent") group.absent += 1;
    if (item.status === "holiday") group.holidays += 1;
  }
  // newest month first (items already arrive newest-first)
  return [...map.values()];
}

function SummaryChip({ label, value, className }: { label: string; value: number; className: string }) {
  if (value === 0) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className
      )}
    >
      {value} {label}
    </span>
  );
}

export default function ClassesPage() {
  const [data, setData] = useState<Paginated<ClassItem> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () =>
        api
          .get<ApiResponse<Paginated<ClassItem>>>(studentPath("/classes?page=1&limit=50"))
          .then((r) => r.data!),
      MOCK_CLASSES
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupByMonth(data?.items ?? []), [data]);

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="text-2xl font-bold">My Classes</GradientText>
          <ShinyText
            text={
              data
                ? `${data.pagination.total} sessions in your attendance history`
                : "Your attendance history"
            }
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <EmptyState
          icon={Music}
          title="No classes yet"
          message="Your schedule appears here once enrolled — every session and its attendance will be listed month by month."
        />
      )}

      {!loading &&
        groups.map((group, gi) => (
          <BlurFade key={group.key} delay={0.1 + gi * 0.1} inView={gi > 1}>
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-brand" />
                  {group.label}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SummaryChip
                    label="present"
                    value={group.present}
                    className="bg-emerald-400/12 text-emerald-500 dark:text-emerald-400"
                  />
                  <SummaryChip
                    label="absent"
                    value={group.absent}
                    className="bg-destructive/10 text-destructive"
                  />
                  <SummaryChip
                    label="holiday"
                    value={group.holidays}
                    className="bg-amber-400/12 text-amber-500 dark:text-amber-400"
                  />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <BorderBeam size={60} duration={8} />
                <ul className="divide-y divide-border/50">
                  {group.items.map((item) => {
                    const d = new Date(`${item.date.slice(0, 10)}T00:00:00`);
                    return (
                      <li
                        key={item.date}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand/10 leading-none">
                            <span className="text-sm font-bold text-brand">{d.getDate()}</span>
                            <span className="mt-0.5 text-[9px] font-semibold uppercase text-brand/70">
                              {WEEKDAYS[d.getDay()]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.batchName}</p>
                            <p className="text-xs text-muted-foreground">{item.time}</p>
                          </div>
                        </div>
                        <ClassStatusBadge status={item.status as ClassStatus} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </BlurFade>
        ))}
    </div>
  );
}
