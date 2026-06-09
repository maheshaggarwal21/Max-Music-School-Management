import { cn } from "@maxmusic/ui";

/** Pulse placeholder block — used while page data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Skeleton for a StatsCard row. */
export function StatsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a DataTable while the first load is in flight. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-brand-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4", c === 0 ? "w-28" : c === cols - 1 ? "w-16" : "flex-1")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
