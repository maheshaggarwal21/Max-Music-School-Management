"use client";
import { useEffect, useState } from "react";
import { CalendarRange, GraduationCap, IndianRupee, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BorderBeam, Button, Input, cn } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { ok } from "@/lib/mocks";
import type { ApiResponse, ClassLevelItem } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";
import { Toggle } from "@/components/toggle";

// Class levels — reusable fee + duration templates that pre-fill a student's
// total fee and validity window at enrollment. Amounts entered in ₹, stored as paise.

function normalize(data: unknown): ClassLevelItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ClassLevelItem[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.classLevels)) return obj.classLevels as ClassLevelItem[];
  if (Array.isArray(obj.items)) return obj.items as ClassLevelItem[];
  return [];
}

export default function ClassPage() {
  const [levels, setLevels] = useState<ClassLevelItem[] | null>(null);
  const [name, setName] = useState("");
  const [upcomingRupees, setUpcomingRupees] = useState("");
  const [paidRupees, setPaidRupees] = useState("");
  const [days, setDays] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<unknown>>(adminPath("/class-levels")),
      ok<unknown>({ classLevels: [] })
    ).then((r) => !cancelled && setLevels(normalize(r.data)));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (c: ClassLevelItem) => {
    setLevels((prev) => (prev ?? []).map((x) => (x._id === c._id ? { ...x, isActive: !x.isActive } : x)));
    await mockable(
      () => api.patch<ApiResponse>(adminPath(`/class-levels/${c._id}`), { isActive: !c.isActive }),
      ok(null),
      250
    );
    toast.success(`${c.name} ${c.isActive ? "deactivated" : "activated"}`);
  };

  const create = async () => {
    const upcoming = Number(upcomingRupees);
    const paid = paidRupees === "" ? 0 : Number(paidRupees);
    const d = Number(days);
    if (!name.trim()) return toast.error("Enter a class name");
    if (!Number.isFinite(upcoming) || upcoming <= 0) return toast.error("Enter a valid fee (Upcoming Amount)");
    if (!Number.isFinite(d) || d < 1) return toast.error("Enter the days assigned (≥ 1)");
    if (!Number.isFinite(paid) || paid < 0) return toast.error("Paid amount is invalid");

    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        upcomingAmount: Math.round(upcoming * 100),
        paidAmount: Math.round(paid * 100),
        days: Math.round(d),
      };
      const res = await mockable(
        () => api.post<ApiResponse<{ classLevel: ClassLevelItem }>>(adminPath("/class-levels"), body),
        ok({ classLevel: { _id: `cls_local_${Date.now()}`, ...body, isActive: true } })
      );
      const created = res.data?.classLevel;
      if (created) setLevels((prev) => [created, ...(prev ?? [])]);
      setName("");
      setUpcomingRupees("");
      setPaidRupees("");
      setDays("");
      toast.success(`Class "${body.name}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add class");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = (levels ?? []).filter((c) => c.isActive).length;

  return (
    <PageShell title="Class Levels" subtitle="Fee + duration templates that pre-fill student enrollment">
      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Registered class levels */}
        <BlurFade delay={0.1} className="xl:col-span-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={60} duration={12} />
            <div className="flex items-center justify-between border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <GraduationCap className="h-3.5 w-3.5" />
                Class Levels
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fee &amp; Duration
              </span>
            </div>

            {!levels ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : levels.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No class levels yet — create your first on the right.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {levels.map((c) => (
                  <li key={c._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <GraduationCap className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <IndianRupee className="h-3 w-3" />
                            {formatCurrency(c.upcomingAmount)} fee
                          </span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <CalendarRange className="h-3 w-3" />
                            {c.days} days
                          </span>
                          {c.paidAmount > 0 && (
                            <span className="tabular-nums">{formatCurrency(c.paidAmount)} default paid</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          c.isActive ? "text-brand" : "text-muted-foreground/60"
                        )}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                      <Toggle checked={c.isActive} onChange={() => toggle(c)} label={`Toggle ${c.name}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Classes: {levels?.length ?? 0}</span>
              <span>{activeCount} active</span>
            </div>
          </div>
        </BlurFade>

        {/* New class level */}
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={50} duration={10} />
            <div className="border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Plus className="h-3.5 w-3.5" />
                New Class
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Add Level
              </p>
            </div>
            <div className="space-y-3 p-5">
              <Input label="Class name" placeholder="e.g. Class 1" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Upcoming Amount (₹) — total fee"
                type="number"
                min={0}
                placeholder="8997"
                value={upcomingRupees}
                onChange={(e) => setUpcomingRupees(e.target.value)}
                required
              />
              <Input
                label="Paid Amount (₹) — default"
                type="number"
                min={0}
                placeholder="0"
                value={paidRupees}
                onChange={(e) => setPaidRupees(e.target.value)}
              />
              <Input
                label="Days Assigned"
                type="number"
                min={1}
                placeholder="90"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
              />
              <Button variant="brand" className="mt-1 w-full rounded-lg" onClick={create} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Class
              </Button>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Selecting a class when enrolling a student pre-fills their total fee and validity
                days. The amount left to pay is tracked automatically.
              </p>
            </div>
          </div>
        </BlurFade>
      </div>
    </PageShell>
  );
}
