"use client";
import * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, ChevronDown } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";

export interface TimePickerProps {
  value: string;                 // "HH:mm" 24-hour, or "" when unset
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minuteStep?: number;           // default 5
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const pad = (n: number) => `${n}`.padStart(2, "0");

function parse(value: string): { h12: number; minute: number; ampm: "AM" | "PM" } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!m) return null;
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(h24) || Number.isNaN(minute)) return null;
  return {
    h12: h24 % 12 === 0 ? 12 : h24 % 12,
    minute,
    ampm: h24 >= 12 ? "PM" : "AM",
  };
}

function build(h12: number, minute: number, ampm: "AM" | "PM"): string {
  const h24 = ampm === "PM" ? (h12 % 12) + 12 : h12 % 12;
  return `${pad(h24)}:${pad(minute)}`;
}

function display(value: string): string | null {
  const p = parse(value);
  if (!p) return null;
  return `${p.h12}:${pad(p.minute)} ${p.ampm}`;
}

/**
 * Elegant 12-hour time picker — Hour · Minute · AM/PM columns in a portalled
 * popover (escapes animated/overflow ancestors). Emits a 24-hour "HH:mm" string
 * so it sorts and compares lexically like the native <input type="time">.
 */
export function TimePicker({
  value, onChange, label, error, required,
  placeholder = "Select time", disabled = false, className, minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const minutes = React.useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < 60; m += Math.max(1, minuteStep)) out.push(m);
    return out;
  }, [minuteStep]);

  const current = parse(value);
  const h12 = current?.h12 ?? null;
  const minute = current?.minute ?? null;
  const ampm = current?.ampm ?? null;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    // Reposition on PAGE scroll only — ignore scrolls inside the picker's own
    // columns, otherwise the capture-phase listener fights their internal scroll.
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      reposition();
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Emit the combined value, filling sensible defaults for the not-yet-picked parts.
  const commit = (next: { h12?: number; minute?: number; ampm?: "AM" | "PM" }) => {
    const nh = next.h12 ?? h12 ?? 12;
    const nm = next.minute ?? minute ?? 0;
    const na = next.ampm ?? ampm ?? "AM";
    onChange(build(nh, nm, na));
  };

  const text = display(value);

  const Column = ({ children }: { children: React.ReactNode }) => (
    <div className="flex max-h-[208px] min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-1 py-1">
      {children}
    </div>
  );

  const cell = (active: boolean) =>
    cn(
      "shrink-0 rounded-md px-2 py-1.5 text-center text-sm tabular-nums transition-colors cursor-pointer",
      active
        ? "bg-brand text-white font-semibold shadow-sm"
        : "text-foreground hover:bg-muted"
    );

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
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            error && "border-destructive"
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={cn("flex-1 truncate text-left tabular-nums", !text && "text-muted-foreground")}>
            {text ?? placeholder}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && mounted && coords && createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: Math.max(coords.width, 248), zIndex: 9999 }}
            className="overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="grid grid-cols-[1fr_1fr_auto] border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="px-1 py-1.5 text-center">Hour</span>
              <span className="px-1 py-1.5 text-center">Min</span>
              <span className="px-3 py-1.5 text-center">AM/PM</span>
            </div>
            <div className="flex divide-x divide-border">
              <Column>
                {HOURS.map((h) => (
                  <button key={h} type="button" className={cell(h12 === h)} onClick={() => commit({ h12: h })}>
                    {pad(h)}
                  </button>
                ))}
              </Column>
              <Column>
                {minutes.map((m) => (
                  <button key={m} type="button" className={cell(minute === m)} onClick={() => commit({ minute: m })}>
                    {pad(m)}
                  </button>
                ))}
              </Column>
              <div className="flex flex-col gap-0.5 px-1 py-1">
                {(["AM", "PM"] as const).map((a) => (
                  <button key={a} type="button" className={cn(cell(ampm === a), "px-3")} onClick={() => commit({ ampm: a })}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {text ?? "--:-- --"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
