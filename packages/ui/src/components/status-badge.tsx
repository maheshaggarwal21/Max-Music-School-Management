import { cn } from "@maxmusic/ui/lib/utils";

// Minimal badge: quiet outlined pill with neutral text — the semantic color
// lives ONLY in the dot. Four tones + the steel-blue brand accent; no pink, no violet.
const DOT = {
  positive: "bg-emerald-500",
  attention: "bg-amber-500",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  brand: "bg-brand",
} as const;

const TONE = {
  // generic / institution status
  active: "positive",
  pending: "attention",
  hold: "attention",
  inactive: "neutral",
  suspended: "negative",
  terminated: "negative",
  // institution mode
  managed: "neutral",
  autonomous: "brand",
  // student joinStatus
  trial: "attention",
  active_soon: "attention",
  // payments
  paid: "positive",
  unpaid: "negative",
  overdue: "negative",
  partial: "attention",
  free: "neutral",
  // batches
  setting: "attention",
  archived: "neutral",
  // requests
  approved: "positive",
  rejected: "negative",
  // reconciliation
  matched: "positive",
  unmatched: "attention",
  // mode of class
  online: "brand",
  offline: "neutral",
} as const satisfies Record<string, keyof typeof DOT>;

export type StatusBadgeStatus = keyof typeof TONE;

function label(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status }: { status: StatusBadgeStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/75 whitespace-nowrap">
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          DOT[TONE[status] ?? "neutral"]
        )}
      />
      {label(status)}
    </span>
  );
}
