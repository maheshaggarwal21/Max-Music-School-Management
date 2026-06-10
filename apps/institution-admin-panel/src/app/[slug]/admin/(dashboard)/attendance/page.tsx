"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BlurFade, BorderBeam, Select, StatusBadge, cn,
} from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_BATCHES, mockAttendanceGrid, ok } from "@/lib/mocks";
import type { ApiResponse, AttendanceGrid } from "@/lib/types";

// Cell mark union, derived from the contract's grid shape.
type AttendanceStatusValue = AttendanceGrid["rows"][number]["marks"][string];
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeletons";

// Cell cycle order on click
const CYCLE: AttendanceStatusValue[] = ["present", "absent", "holiday", "credited", "unmarked"];

const CELL_STYLE: Record<AttendanceStatusValue, string> = {
  present: "bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-400/25",
  absent: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  holiday: "bg-amber-400/15 text-amber-600 dark:text-amber-400 hover:bg-amber-400/25",
  credited: "bg-brand/10 text-brand hover:bg-brand/20",
  unmarked: "bg-muted/60 text-muted-foreground hover:bg-muted",
};

const CELL_CHAR: Record<AttendanceStatusValue, string> = {
  present: "P", absent: "A", holiday: "H", credited: "C", unmarked: "–",
};

const LEGEND: { status: AttendanceStatusValue; label: string }[] = [
  { status: "present", label: "Present" },
  { status: "absent", label: "Absent" },
  { status: "holiday", label: "Holiday" },
  { status: "credited", label: "Credited" },
  { status: "unmarked", label: "Unmarked" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function AttendancePage() {
  const selectableBatches = useMemo(
    () => MOCK_BATCHES.filter((b) => b.status === "active" || b.status === "inactive"),
    []
  );
  const [batchId, setBatchId] = useState<string | null>(selectableBatches[0]?._id ?? null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [grid, setGrid] = useState<AttendanceGrid | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    setLoading(true);
    const mm = `${month + 1}`.padStart(2, "0");
    const from = `${year}-${mm}-01`;
    const to = `${year}-${mm}-${`${lastDayOfMonth(year, month)}`.padStart(2, "0")}`;
    mockable(
      () =>
        api.get<ApiResponse<AttendanceGrid>>(
          adminPath(`/attendance?batchId=${batchId}&from=${from}&to=${to}`)
        ),
      ok(mockAttendanceGrid(batchId, year, month))
    ).then((r) => {
      if (cancelled) return;
      setGrid(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [batchId, year, month]);

  const stepMonth = useCallback(
    (delta: number) => {
      const d = new Date(year, month + delta, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    },
    [year, month]
  );

  const cycleCell = (studentId: string, date: string) => {
    setGrid((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => {
          if (row.student._id !== studentId) return row;
          const current = row.marks[date] ?? "unmarked";
          const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
          return { ...row, marks: { ...row.marks, [date]: next } };
        }),
      };
    });
  };

  return (
    <PageShell
      title="Attendance"
      subtitle="Monthly grid — click a cell to cycle its mark"
    >
      {/* Batch + month pickers */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72">
            <Select
              label="Batch"
              searchable
              placeholder="Select a batch"
              options={selectableBatches.map((b) => ({ value: b._id, label: b.name }))}
              value={batchId}
              onChange={setBatchId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Month</span>
            <div className="flex h-9 items-center gap-1 rounded-md border border-input bg-background px-1 shadow-xs">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
                className="rounded p-1.5 transition-colors hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[8.5rem] text-center text-sm font-medium">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                aria-label="Next month"
                className="rounded p-1.5 transition-colors hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Legend */}
      <BlurFade delay={0.15}>
        <div className="flex flex-wrap items-center gap-2">
          {LEGEND.map(({ status, label }) => (
            <span
              key={status}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                  CELL_STYLE[status]
                )}
              >
                {CELL_CHAR[status]}
              </span>
              {label}
            </span>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {!batchId ? (
          <EmptyState
            icon={CalendarCheck}
            title="Pick a batch"
            hint="Choose a batch above to see its monthly attendance grid."
          />
        ) : loading || !grid ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-8 w-full" />
            <div className="mt-2 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        ) : grid.rows.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No students in this batch"
            hint="Assign students to this batch to start marking attendance."
          />
        ) : grid.dates.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No class days this month"
            hint="This batch's day pattern has no sessions in the selected month."
          />
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={80} duration={10} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-brand-muted/40">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-brand">
                      Student
                    </th>
                    {grid.dates.map((date) => {
                      const d = new Date(`${date}T00:00:00`);
                      return (
                        <th key={date} className="px-2 py-2 text-center">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            {d.toLocaleDateString("en-IN", { weekday: "short" })}
                          </p>
                          <p className="text-xs font-bold text-brand">{d.getDate()}</p>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((row) => (
                    <tr key={row.student._id} className="border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                        <p className="whitespace-nowrap text-sm font-medium">{row.student.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {row.student.displayId}
                        </p>
                      </td>
                      {grid.dates.map((date) => {
                        const status = row.marks[date] ?? "unmarked";
                        return (
                          <td key={date} className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => cycleCell(row.student._id, date)}
                              title={`${row.student.name} · ${date} · ${status} (click to change)`}
                              className={cn(
                                "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all duration-150 hover:scale-110",
                                CELL_STYLE[status]
                              )}
                            >
                              {CELL_CHAR[status]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              {grid.batch.name} · {grid.rows.length} students · {grid.dates.length} class days in{" "}
              {MONTH_NAMES[month]} {year}
            </p>
          </div>
        )}
      </BlurFade>
    </PageShell>
  );
}
