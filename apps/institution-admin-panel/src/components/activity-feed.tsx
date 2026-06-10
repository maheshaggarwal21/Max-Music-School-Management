"use client";
import {
  CalendarCheck, CircleDot, Pencil, Plus, UserCog, Wallet, type LucideIcon,
} from "lucide-react";
import { formatCurrency, formatDate } from "@maxmusic/utils";
import type { AuditLogItem } from "@/lib/types";

/** "3h ago" / "2d ago" style relative timestamp; falls back to formatDate. */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(seconds)) return "—";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(iso);
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  CREATE_STUDENT: Plus,
  UPDATE_STUDENT: Pencil,
  UPDATE_PAID_AMOUNT: Wallet,
  UPDATE_JOIN_STATUS: CircleDot,
  ASSIGN_BATCH: UserCog,
  MARK_ATTENDANCE: CalendarCheck,
  CREATE_TEACHER: Plus,
  UPDATE_TEACHER: Pencil,
  APPROVE_REQUEST: CircleDot,
};

const MONEY_FIELDS = new Set(["paidAmount", "upcomingAmount", "salaryAmount"]);

function renderValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field) && typeof value === "number") return formatCurrency(value);
  return String(value);
}

function humanizeField(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** Per-student audit timeline ("changed BY SYSTEM" style feed). */
export function ActivityFeed({ items }: { items: AuditLogItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {items.map((item) => {
        const Icon = ACTION_ICONS[item.action] ?? Pencil;
        return (
          <li key={item._id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-3 w-3 text-brand" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium">{humanizeAction(item.action)}</p>
              <span className="text-[11px] text-muted-foreground" title={formatDate(item.createdAt)}>
                {timeAgo(item.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              by <span className="font-medium text-foreground/80">{item.actorName}</span>
              {" · "}
              <span className="uppercase tracking-wide">{item.actorRole.replace(/_/g, " ")}</span>
            </p>
            {item.changes.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {item.changes.map((c, i) => (
                  <p key={i} className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground/70">{humanizeField(c.field)}</span>
                    {" changed from "}
                    <span className="font-medium text-foreground/80">{renderValue(c.field, c.from)}</span>
                    {" to "}
                    <span className="font-medium text-brand">{renderValue(c.field, c.to)}</span>
                  </p>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
