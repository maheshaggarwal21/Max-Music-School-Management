// Local workaround: the shared StatusBadge (packages/ui) has no variants for
// attendance statuses (present / absent / holiday / upcoming / credited).
// Mirrors its visual style exactly. If Dev B later extends packages/ui's
// StatusBadge, replace this with the shared component.
import { cn } from "@maxmusic/ui";

const variants = {
  present: "bg-emerald-400/12 text-emerald-500 dark:text-emerald-400",
  absent: "bg-destructive/10 text-destructive",
  holiday: "bg-amber-400/12 text-amber-500 dark:text-amber-400",
  credited: "bg-brand/10 text-brand",
  upcoming: "bg-brand/10 text-brand",
} as const;

const dot = {
  present: "bg-emerald-400",
  absent: "bg-destructive",
  holiday: "bg-amber-400",
  credited: "bg-brand",
  upcoming: "bg-brand",
} as const;

const labels: Record<keyof typeof variants, string> = {
  present: "Present",
  absent: "Absent",
  holiday: "Holiday · credited",
  credited: "Credited",
  upcoming: "Upcoming",
};

export type ClassStatus = keyof typeof variants;

export function ClassStatusBadge({ status }: { status: ClassStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        variants[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status] ?? "bg-muted-foreground")} />
      {labels[status] ?? status}
    </span>
  );
}
