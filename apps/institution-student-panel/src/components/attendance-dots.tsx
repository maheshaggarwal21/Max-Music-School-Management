"use client";
import { cn } from "@maxmusic/ui";
import { formatDate } from "@maxmusic/utils";

import type { ClassItem } from "@/lib/types";

const dotColor: Record<ClassItem["status"], string> = {
  present: "bg-emerald-400",
  absent: "bg-destructive",
  holiday: "bg-amber-400",
  upcoming: "bg-brand/40",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "Present", className: "bg-emerald-400" },
  { label: "Absent", className: "bg-destructive" },
  { label: "Holiday (credited)", className: "bg-amber-400" },
];

/**
 * Last-N attendance strip — one colored dot per session, oldest → newest,
 * with a legend underneath.
 */
export function AttendanceDots({
  sessions,
  count = 10,
  className,
}: {
  sessions: ClassItem[];
  count?: number;
  className?: string;
}) {
  // sessions arrive newest-first; show oldest → newest left to right
  const recent = sessions.slice(0, count).reverse();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        {recent.map((s) => (
          <span
            key={s.date}
            title={`${formatDate(s.date)} — ${s.status}`}
            className={cn(
              "h-3.5 w-3.5 rounded-full transition-transform duration-200 hover:scale-125",
              dotColor[s.status] ?? "bg-muted-foreground"
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((l) => (
          <span
            key={l.label}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className={cn("h-2 w-2 rounded-full", l.className)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
