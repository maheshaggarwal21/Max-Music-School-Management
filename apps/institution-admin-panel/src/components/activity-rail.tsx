"use client";
import {
  CalendarDays, CircleDot, IndianRupee, Pencil, Plus, UserCog, type LucideIcon,
} from "lucide-react";
import { Avatar, cn } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import type { AuditLogItem } from "@/lib/types";
import { timeAgo } from "./activity-feed";

// "Recent Activity · LIVE" rail — the node-graph timeline used beside the big
// edit forms: one node per change with the field chip, red old value → green
// new value, and the actor underneath. Flattens AuditLogItem.changes so every
// tiny edit gets its own node.

const MONEY_FIELDS = new Set(["paidAmount", "upcomingAmount", "salaryAmount"]);
const DATE_FIELDS = new Set(["validityStart", "validityEnd", "dob"]);

function fieldIcon(field: string | null): LucideIcon {
  if (!field) return Plus;
  if (MONEY_FIELDS.has(field)) return IndianRupee;
  if (DATE_FIELDS.has(field)) return CalendarDays;
  if (field === "teacher" || field === "batch") return UserCog;
  if (field.toLowerCase().includes("status")) return CircleDot;
  return Pencil;
}

function fieldLabel(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

function renderValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatCurrency(value);
  return String(value);
}

function roleLabel(role: AuditLogItem["actorRole"]): string {
  if (role === "institution_admin") return "ADMIN";
  if (role === "superadmin") return "OPERATOR";
  return role.toUpperCase();
}

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

interface RailNode {
  key: string;
  field: string | null; // null ⇒ plain action (e.g. CREATE_STUDENT)
  action: string;
  from: unknown;
  to: unknown;
  actorName: string;
  actorRole: AuditLogItem["actorRole"];
  createdAt: string;
}

function flatten(items: AuditLogItem[]): RailNode[] {
  const nodes: RailNode[] = [];
  for (const item of items) {
    if (item.changes.length === 0) {
      nodes.push({
        key: item._id,
        field: null,
        action: item.action,
        from: null,
        to: null,
        actorName: item.actorName,
        actorRole: item.actorRole,
        createdAt: item.createdAt,
      });
      continue;
    }
    item.changes.forEach((c, i) => {
      nodes.push({
        key: `${item._id}_${i}`,
        field: c.field,
        action: item.action,
        from: c.from,
        to: c.to,
        actorName: item.actorName,
        actorRole: item.actorRole,
        createdAt: item.createdAt,
      });
    });
  }
  return nodes;
}

export function ActivityRail({ items, className }: { items: AuditLogItem[]; className?: string }) {
  const nodes = flatten(items);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          Recent Activity
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {nodes.length} event{nodes.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Nodes */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {nodes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <div className="relative">
            <span className="absolute bottom-3 left-[15px] top-3 w-px bg-border" />
            <div className="space-y-3">
              {nodes.map((n) => {
                const Icon = fieldIcon(n.field);
                return (
                  <div key={n.key} className="relative flex gap-3">
                    <span className="relative z-[1] mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                      <Icon className="h-3.5 w-3.5 text-brand" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-3 shadow-sm">
                      <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                        {n.field ? fieldLabel(n.field) : actionLabel(n.action)}
                      </span>
                      {n.field && (
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive line-through">
                            {renderValue(n.field, n.from)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="rounded-md bg-emerald-400/12 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                            {renderValue(n.field, n.to)}
                          </span>
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Avatar name={n.actorName} size="sm" />
                          <span className="truncate text-xs font-medium">{n.actorName}</span>
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground">
                            {roleLabel(n.actorRole)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
