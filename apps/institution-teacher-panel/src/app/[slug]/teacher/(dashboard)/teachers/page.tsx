"use client";
// Teachers roster — every teacher in the institution with their KPI %, 0–5
// performance rating, and status. Click the arrow to open a colleague's class
// schedule management page. KPI criteria: config/teacherKpi.js (backend).
// WHITE-LABEL: institution brand only; salary is never shown here.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Mail, MessageSquare, RotateCw, Search, Star, Users } from "lucide-react";
import { BlurFade, GradientText, ShinyText, cn } from "@maxmusic/ui";
import { api, mockable, teacherPath } from "@/lib/api";
import { MOCK_COLLEAGUES_RESPONSE } from "@/lib/mocks";
import type { ApiResponse, TeacherKpiRow } from "@/lib/types";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

export default function TeachersPage() {
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/teacher`;
  const [rows, setRows] = useState<TeacherKpiRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = () => {
    mockable(
      () => api.get<ApiResponse<TeacherKpiRow[]>>(teacherPath("/colleagues")),
      MOCK_COLLEAGUES_RESPONSE
    ).then((r) => setRows(r.data ?? []));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter(
      (t) => t.name.toLowerCase().includes(q) || t.displayId.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="relative mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <GradientText className="!mx-0 !justify-start text-2xl font-bold">Teachers</GradientText>
            <ShinyText
              text={rows ? `${rows.length} faculty · institution roster` : "Loading roster…"}
              speed={6}
              className="mt-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search faculty…"
                className="h-9 w-60 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <button
              type="button"
              onClick={() => { setRows(null); load(); }}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.1} className="mt-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* header */}
          <div className="grid grid-cols-[1.4fr_1.6fr_auto_0.8fr_1fr_1.4fr_auto] items-center gap-3 border-b border-border bg-muted/30 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Identification</span>
            <span>Faculty Name</span>
            <span className="hidden md:block">Connect</span>
            <span className="hidden md:block">Account</span>
            <span className="hidden lg:block">Performance</span>
            <span>KPI %</span>
            <span className="sr-only">Open</span>
          </div>

          {rows === null ? (
            <div className="p-5"><CardListSkeleton count={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="No teachers found" description="No faculty match your search." />
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((t, i) => (
                <BlurFade key={t._id} delay={0.05 + i * 0.04} inView>
                  <li>
                    <Link
                      href={`${base}/teachers/${t._id}`}
                      className="group grid grid-cols-[1.4fr_1.6fr_auto_0.8fr_1fr_1.4fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                    >
                      {/* identification */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums">{t.displayId}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Since {new Date(t.since).getFullYear()}
                        </p>
                      </div>
                      {/* name */}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {t.name}
                          {t.role === "owner" && (
                            <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
                              Owner
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{t.email}</p>
                      </div>
                      {/* connect */}
                      {/* Buttons, not <a> — these sit inside the row's <Link>, and an
                          anchor nested in an anchor is invalid HTML (React warns). */}
                      <div className="hidden items-center gap-1.5 text-muted-foreground md:flex">
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `mailto:${t.email}`; }}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground"
                          aria-label="Email"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${t.mobile}`; }}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground"
                          aria-label="Message"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* account */}
                      <span
                        className={cn(
                          "hidden text-[10px] font-bold uppercase tracking-wider md:block",
                          t.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}
                      >
                        {t.status}
                      </span>
                      {/* performance */}
                      <div className="hidden lg:block">
                        <p className="flex items-center gap-1 text-sm font-bold tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {t.performance.toFixed(1)}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Global rating</p>
                      </div>
                      {/* kpi */}
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-bold tabular-nums">{t.kpiPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand transition-all"
                            style={{ width: `${Math.max(2, t.kpiPercent)}%` }}
                          />
                        </div>
                      </div>
                      {/* open */}
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-brand group-hover:text-brand">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                </BlurFade>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Total: {rows?.length ?? 0} faculty</span>
            <span>{(rows ?? []).filter((t) => t.status === "active").length} active</span>
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
