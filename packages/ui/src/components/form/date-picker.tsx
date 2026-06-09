"use client";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export interface DateRange {
  from: string | null; // ISO yyyy-mm-dd
  to: string | null;
}

interface BaseProps {
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export type DatePickerProps =
  | (BaseProps & { mode?: "single"; value: string | null; onChange: (value: string | null) => void })
  | (BaseProps & { mode: "range"; value: DateRange; onChange: (value: DateRange) => void });

function toIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseIso(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** en-IN style display: 12 Jan 2026 */
function display(iso: string | null): string {
  const d = parseIso(iso);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function DatePicker(props: DatePickerProps) {
  const {
    label, error, required, disabled = false, className,
    placeholder = props.mode === "range" ? "Select date range" : "Select date",
  } = props;
  const isRange = props.mode === "range";

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const initial =
    (isRange ? parseIso((props.value as DateRange).from) : parseIso(props.value as string | null)) ??
    new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    // Monday-first offset
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const range = isRange ? (props.value as DateRange) : null;
  const single = !isRange ? (props.value as string | null) : null;

  const pick = (d: Date) => {
    const iso = toIso(d);
    if (!isRange) {
      (props.onChange as (v: string | null) => void)(iso);
      setOpen(false);
      return;
    }
    const r = range!;
    const onChange = props.onChange as (v: DateRange) => void;
    if (!r.from || (r.from && r.to)) {
      onChange({ from: iso, to: null });
    } else if (iso < r.from) {
      onChange({ from: iso, to: r.from });
      setOpen(false);
    } else {
      onChange({ from: r.from, to: iso });
      setOpen(false);
    }
  };

  const isPicked = (d: Date) => {
    const iso = toIso(d);
    if (!isRange) return single === iso;
    return range!.from === iso || range!.to === iso;
  };

  const inRange = (d: Date) => {
    if (!isRange || !range!.from || !range!.to) return false;
    const iso = toIso(d);
    return iso > range!.from && iso < range!.to;
  };

  const text = isRange
    ? range!.from
      ? `${display(range!.from)}${range!.to ? ` – ${display(range!.to)}` : " – …"}`
      : ""
    : display(single);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)} ref={rootRef}>
      {label && (
        <span className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            error && "border-destructive"
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate text-left", !text && "text-muted-foreground")}>
            {text || placeholder}
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-popover p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={prevMonth} aria-label="Previous month"
                className="rounded p-1 transition-colors hover:bg-muted">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} aria-label="Next month"
                className="rounded p-1 transition-colors hover:bg-muted">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">{w}</span>
              ))}
              {grid.map((d, i) =>
                d ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(d)}
                    className={cn(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors hover:bg-muted",
                      isPicked(d) && "bg-brand text-brand-foreground hover:bg-brand",
                      inRange(d) && "bg-brand/15 text-brand rounded-none"
                    )}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span key={i} className="h-7 w-7" />
                )
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
