"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BorderBeam, Button, cn } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_DAY_PATTERNS, ok } from "@/lib/mocks";
import type { ApiResponse, DayPatternItem } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";
import { Toggle } from "@/components/toggle";

// Suitable Days — dedicated console (pulled out of Settings).
// Layout: wide "Weekly Recurring Day Patterns" list + narrow "New Pattern"
// setup-cycle card. Reference design replicated in the institution's brand
// color (white-label — never the reference's palette).

const WEEK = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];
const FULL_DAY: Record<string, string> = Object.fromEntries(WEEK.map((d) => [d.value, d.label]));
const SHORT_DAY: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

function normalizePatterns(data: unknown): DayPatternItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as DayPatternItem[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.dayPatterns)) return obj.dayPatterns as DayPatternItem[];
  if (Array.isArray(obj.items)) return obj.items as DayPatternItem[];
  return [];
}

export default function SuitableDaysPage() {
  const [patterns, setPatterns] = useState<DayPatternItem[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<unknown>>(adminPath("/day-patterns")),
      ok<unknown>(MOCK_DAY_PATTERNS)
    ).then((r) => !cancelled && setPatterns(normalizePatterns(r.data)));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (p: DayPatternItem) => {
    setPatterns((prev) =>
      (prev ?? []).map((x) => (x._id === p._id ? { ...x, isActive: !x.isActive } : x))
    );
    await mockable(
      () => api.patch<ApiResponse>(adminPath(`/day-patterns/${p._id}`), { isActive: !p.isActive }),
      ok(null),
      250
    );
    toast.success(`${p.label} ${p.isActive ? "disabled" : "activated"}`);
  };

  const createCycle = async () => {
    if (!selected.length) return;
    setCreating(true);
    try {
      const ordered = WEEK.map((d) => d.value).filter((d) => selected.includes(d));
      await mockable(
        () => api.post<ApiResponse>(adminPath("/day-patterns"), { days: ordered }),
        ok(null),
        400
      );
      setPatterns((prev) => [
        ...(prev ?? []),
        {
          _id: `dp_local_${Date.now()}`,
          days: ordered,
          label: ordered.map((d) => SHORT_DAY[d]).join(" · "),
          isActive: true,
        },
      ]);
      setSelected([]);
      toast.success("Pattern created — it is now selectable in batch and enrollment forms");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = (patterns ?? []).filter((p) => p.isActive).length;

  return (
    <PageShell
      title="Schedule Configurations"
      subtitle="Available day patterns for class rosters"
    >
      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Weekly recurring day patterns */}
        <BlurFade delay={0.1} className="xl:col-span-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={60} duration={12} />
            <div className="flex items-center justify-between border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <CalendarDays className="h-3.5 w-3.5" />
                Weekly Recurring Day Patterns
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status &amp; Controls
              </span>
            </div>

            {!patterns ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : patterns.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No day patterns yet — create your first cycle on the right.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {patterns.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                        <CalendarDays className="h-3.5 w-3.5 text-brand" />
                      </span>
                      <p className="truncate text-sm font-medium">
                        {p.days.map((d) => FULL_DAY[d] ?? d).join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          p.isActive ? "text-brand" : "text-muted-foreground/60"
                        )}
                      >
                        {p.isActive ? "Active" : "Disabled"}
                      </span>
                      <Toggle checked={p.isActive} onChange={() => toggle(p)} label={`Toggle ${p.label}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Total patterns: {patterns?.length ?? 0}</span>
              <span>{activeCount} active</span>
            </div>
          </div>
        </BlurFade>

        {/* New pattern — setup cycle */}
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={50} duration={10} />
            <div className="border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Plus className="h-3.5 w-3.5" />
                New Pattern
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Setup Cycle
              </p>
            </div>
            <div className="space-y-2 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Select cycle days
              </p>
              {WEEK.map((d) => {
                const on = selected.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() =>
                      setSelected((prev) =>
                        on ? prev.filter((x) => x !== d.value) : [...prev, d.value]
                      )
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
                      on
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-brand/30 hover:text-foreground"
                    )}
                  >
                    {d.label}
                    {on && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
              <Button
                variant="brand"
                className="mt-2 w-full rounded-lg"
                onClick={createCycle}
                disabled={creating || selected.length === 0}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Cycle
              </Button>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Choose multiple days to create a combined weekly pattern for recurring classes.
                Only <span className="font-semibold text-foreground/80">active</span> patterns are
                offered in batch and enrollment forms.
              </p>
            </div>
          </div>
        </BlurFade>
      </div>
    </PageShell>
  );
}
