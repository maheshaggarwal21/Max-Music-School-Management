"use client";
// Live node-graph activity rail — every field change is a node on a vertical
// connector with a slow traveling brand pulse (websocket-feed aesthetic, in
// design-system tokens only). Entries listed in `liveBatch` were just recorded
// and stream in with a staggered spring entrance + a brief glow flash on the
// node, newest landing on top.
//
// The traveling-pulse keyframe is defined locally in this component (inline
// <style>) — packages/ui stays untouched.

import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  IndianRupee,
  Sparkles,
  ToggleLeft,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, cn, theme } from "@maxmusic/ui";
import { formatCurrency, formatDate } from "@maxmusic/utils";
import { Skeleton } from "@/components/skeleton";
import type { ActorRole, AuditLogItem } from "@/lib/types";

const ROLE_BADGE: Record<ActorRole, { label: string; className: string }> = {
  superadmin: { label: "operator", className: "bg-brand/10 text-brand" },
  institution_admin: { label: "admin", className: "bg-violet-400/10 text-violet-500" },
  teacher: { label: "teacher", className: "bg-brand/10 text-brand" },
  student: { label: "student", className: "bg-muted text-muted-foreground" },
  system: { label: "system", className: "bg-muted text-muted-foreground" },
};

/** Icon per field category: amounts → ₹, status → toggle, dates → calendar, profile → user. */
function fieldIcon(field: string): LucideIcon {
  const f = field.toLowerCase();
  if (f.includes("amount") || f.includes("salary") || f.includes("rent") || f.includes("fee"))
    return IndianRupee;
  if (f.includes("status")) return ToggleLeft;
  if (f.includes("validity") || f.includes("date") || f.includes("classes")) return CalendarDays;
  return User;
}

/** camelCase → "PAID AMOUNT" (chip casing handled by CSS uppercase). */
const fieldChip = (field: string): string =>
  field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ");

function formatChangeValue(field: string, v: unknown): string {
  if (v == null || v === "") return "—";
  const f = field.toLowerCase();
  if (
    typeof v === "number" &&
    (f.includes("amount") || f.includes("salary") || f.includes("rent") || f.includes("fee"))
  )
    return formatCurrency(v);
  if (f.includes("validity") || f.includes("date")) return formatDate(String(v));
  if (Array.isArray(v)) return v.join(", ");
  return String(v).replace(/_/g, " ");
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 45_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

export function ActivityGraph({
  entries,
  liveBatch = [],
  loading = false,
  className,
}: {
  entries: AuditLogItem[];
  /** _ids of just-recorded entries in display order (newest first) — get the live entrance. */
  liveBatch?: string[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Local keyframe for the vertical traveling pulse (a vertical BorderBeam). */}
      <style>{`
        @keyframes mm-activity-pulse {
          0%   { top: -16%; opacity: 0; }
          10%  { opacity: 0.9; }
          85%  { opacity: 0.9; }
          100% { top: 108%; opacity: 0; }
        }
      `}</style>

      {/* Header: title + pulsing LIVE dot + entry count */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-4 pr-12">
        <h3 className="text-sm font-semibold">Recent Activity</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          live
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {entries.length} {entries.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* Stream */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-20 flex-1 rounded-lg" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Sparkles className="h-5 w-5 text-brand" />
            </span>
            <p className="text-sm font-medium">No changes yet</p>
            <p className="text-xs text-muted-foreground">Edits appear here live.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical connector */}
            <span aria-hidden className="absolute bottom-2 left-[15.5px] top-2 w-px bg-border" />
            {/* Slow traveling gradient pulse on the connector */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-[13.5px] w-[5px] rounded-full blur-[2px]"
              style={{
                height: 90,
                animation: "mm-activity-pulse 5.5s linear infinite",
                background: `linear-gradient(to bottom, transparent, ${theme.colors.glow.accent50}, transparent)`,
              }}
            />

            <ol className="space-y-5">
              {entries.map((e) => {
                const liveIndex = liveBatch.indexOf(e._id);
                const isLive = liveIndex !== -1;
                // bottom-most live entry lands first, so the batch reads as a stream
                const delay = isLive ? (liveBatch.length - 1 - liveIndex) * 0.13 : 0;
                const changes = e.changes?.length
                  ? e.changes
                  : [{ field: e.action.toLowerCase(), from: null, to: null }];
                const Icon = fieldIcon(changes[0].field);
                const abs = new Date(e.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <motion.li
                    key={e._id}
                    layout
                    initial={isLive ? { opacity: 0, y: -8, scale: 0.97 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26, delay }}
                    className="relative flex gap-3"
                  >
                    {/* Node badge on the connector */}
                    <span
                      className="relative z-[1] mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-brand ring-1 ring-brand/40"
                      style={{ boxShadow: theme.shadows.accentGlowSm }}
                    >
                      {isLive && (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ duration: 1.1, delay: delay + 0.1, ease: "easeOut" }}
                          style={{ boxShadow: `0 0 16px 3px ${theme.colors.glow.accent50}` }}
                        />
                      )}
                      <Icon className="h-3.5 w-3.5" />
                    </span>

                    {/* Event card */}
                    <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background/60 p-3">
                      {changes.map((c, ci) => (
                        <div key={ci} className={cn(ci > 0 && "mt-2.5 border-t border-border/40 pt-2.5")}>
                          <span className="inline-flex rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
                            {fieldChip(c.field)}
                          </span>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive line-through decoration-destructive/50">
                              {formatChangeValue(c.field, c.from)}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="rounded bg-emerald-400/12 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                              {formatChangeValue(c.field, c.to)}
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Actor + relative time */}
                      <div className="mt-2.5 flex min-w-0 items-center gap-1.5">
                        <Avatar name={e.actorName} size="sm" className="h-5 w-5 text-[8px]" />
                        <span className="truncate text-xs font-medium">{e.actorName}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider",
                            ROLE_BADGE[e.actorRole].className
                          )}
                        >
                          {ROLE_BADGE[e.actorRole].label}
                        </span>
                        <span
                          className="ml-auto shrink-0 text-[10px] text-muted-foreground"
                          title={abs}
                        >
                          {relTime(e.createdAt)}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
