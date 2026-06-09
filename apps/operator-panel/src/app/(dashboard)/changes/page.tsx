"use client";
// P5-08 — Changes History: vertical audit timeline with expandable
// before/after JSON diffs; filters (institution, actor role, date range).

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  BlurFade,
  BorderBeam,
  cn,
  DatePicker,
  Select,
  type DateRange,
} from "@maxmusic/ui";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { INSTITUTION_OPTIONS, mockChangesList } from "@/lib/mocks";
import type { ApiResponse, AuditLogItem, Paginated } from "@/lib/types";

const LIMIT = 8;

const ROLE_OPTIONS = [
  { value: "all", label: "All roles" },
  { value: "superadmin", label: "Superadmin" },
  { value: "institution_admin", label: "Institution admin" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "system", label: "System" },
];

const ROLE_DOT: Record<AuditLogItem["actorRole"], string> = {
  superadmin: "bg-brand",
  institution_admin: "bg-violet-400",
  teacher: "bg-emerald-400",
  student: "bg-amber-400",
  system: "bg-muted-foreground",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChangesPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<string | null>("all");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [page, setPage] = useState(1);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        institutionId: institutionId ?? "",
        actorRole: actorRole === "all" ? "" : actorRole ?? "",
        from: range.from ?? "",
        to: range.to ?? "",
      });
      const res = await mockable(
        () => api.get<ApiResponse<Paginated<AuditLogItem>>>(`/api/operator/changes?${params}`),
        mockChangesList({
          page,
          limit: LIMIT,
          institutionId: institutionId ?? undefined,
          actorRole: actorRole ?? "all",
          from: range.from,
          to: range.to,
        })
      );
      if (res.data) {
        setItems(res.data.items);
        setPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load changes");
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [page, institutionId, actorRole, range.from, range.to]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const noResults = !loading && items.length === 0;

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Changes History"
        subtitle="Immutable audit trail — every write across every institution"
      />

      {/* Filters */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            options={[{ value: "", label: "All institutions" }, ...INSTITUTION_OPTIONS]}
            value={institutionId ?? ""}
            onChange={(v) => {
              setInstitutionId(v || null);
              setPage(1);
            }}
            searchable
            className="w-64"
          />
          <Select
            options={ROLE_OPTIONS}
            value={actorRole}
            onChange={(v) => {
              setActorRole(v);
              setPage(1);
            }}
            className="w-48"
          />
          <DatePicker
            mode="range"
            value={range}
            onChange={(v) => {
              setRange(v);
              setPage(1);
            }}
            placeholder="Filter by date range"
            className="w-64"
          />
        </div>
      </BlurFade>

      {/* Timeline */}
      <BlurFade delay={0.2}>
        {initial ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        ) : noResults ? (
          <EmptyState
            icon={History}
            title="No changes in this window"
            description="Nothing matches the current filters. Every create, update and delete across the platform lands here — it cannot be edited or deleted."
          />
        ) : (
          <div
            className={cn(
              "relative transition-opacity duration-200",
              loading && "pointer-events-none opacity-50"
            )}
          >
            {/* vertical line */}
            <span className="absolute bottom-2 left-[17px] top-2 w-px bg-border" />
            <div className="space-y-3">
              {items.map((item, i) => {
                const isOpen = expanded === item._id;
                const hasDiff = item.before !== null || item.after !== null;
                return (
                  <BlurFade key={item._id} delay={0.05 * i}>
                    <div className="relative flex gap-4">
                      {/* timeline dot */}
                      <span className="relative z-[1] mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                        <span
                          className={cn("h-2.5 w-2.5 rounded-full", ROLE_DOT[item.actorRole])}
                        />
                      </span>

                      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <BorderBeam size={40} duration={12} delay={i * 1.5} />
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : item._id)}
                          className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Avatar name={item.actorName} size="sm" />
                              <span className="text-sm font-medium">{item.actorName}</span>
                              <Tag
                                tone={
                                  item.actorRole === "superadmin"
                                    ? "brand"
                                    : item.actorRole === "system"
                                      ? "neutral"
                                      : "violet"
                                }
                              >
                                {item.actorRole.replace(/_/g, " ")}
                              </Tag>
                              {item.impersonatedBy && (
                                <Tag tone="amber">
                                  <ShieldAlert className="h-3 w-3" /> impersonated
                                </Tag>
                              )}
                              <span className="font-mono text-[11px] uppercase tracking-wide text-brand">
                                {item.action}
                              </span>
                            </div>

                            <p className="mt-1.5 truncate text-sm text-muted-foreground">
                              {item.entityLabel ?? `${item.entityType} ${item.entityId}`}
                            </p>

                            {item.changes.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {item.changes.map((c, ci) => (
                                  <p key={ci} className="text-xs">
                                    <span className="font-semibold uppercase tracking-wide">
                                      {c.field}
                                    </span>{" "}
                                    <span className="text-muted-foreground">changed from</span>{" "}
                                    <span className="rounded bg-destructive/10 px-1 py-0.5 font-mono text-destructive">
                                      {formatValue(c.from)}
                                    </span>{" "}
                                    <span className="text-muted-foreground">to</span>{" "}
                                    <span className="rounded bg-emerald-400/12 px-1 py-0.5 font-mono text-emerald-500 dark:text-emerald-400">
                                      {formatValue(c.to)}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {item.institution && <Tag>{item.institution.name}</Tag>}
                              <span className="text-[11px] text-muted-foreground">
                                {timeOf(item.createdAt)}
                              </span>
                              {item.ip && (
                                <span className="font-mono text-[10px] text-muted-foreground/70">
                                  {item.ip}
                                </span>
                              )}
                            </div>
                          </div>

                          {hasDiff && (
                            <ChevronDown
                              className={cn(
                                "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                isOpen && "rotate-180"
                              )}
                            />
                          )}
                        </button>

                        {/* expandable before/after JSON */}
                        <AnimatePresence initial={false}>
                          {isOpen && hasDiff && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-hidden border-t border-border"
                            >
                              <div className="grid gap-3 p-4 sm:grid-cols-2">
                                <div>
                                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive">
                                    Before
                                  </p>
                                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
                                    {item.before ? JSON.stringify(item.before, null, 2) : "null"}
                                  </pre>
                                </div>
                                <div>
                                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                                    After
                                  </p>
                                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
                                    {item.after ? JSON.stringify(item.after, null, 2) : "null"}
                                  </pre>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>

            {/* pager */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                  className="rounded-md p-1.5 transition-all hover:bg-muted disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  aria-label="Next page"
                  className="rounded-md p-1.5 transition-all hover:bg-muted disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </BlurFade>
    </div>
  );
}
