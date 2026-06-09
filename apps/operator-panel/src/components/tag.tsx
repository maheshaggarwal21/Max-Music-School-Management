import { cn } from "@maxmusic/ui";

/** Small inline chip — used for institution tags, panel access, methods… */
export function Tag({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "neutral" | "violet" | "amber";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[180px] items-center gap-1 truncate rounded-md px-2 py-0.5 text-[11px] font-medium",
        tone === "brand" && "bg-brand/10 text-brand",
        tone === "neutral" && "bg-muted text-muted-foreground",
        // violet folded into the brand accent — one accent color across the app
        tone === "violet" && "bg-brand/10 text-brand",
        tone === "amber" && "bg-amber-400/12 text-amber-500 dark:text-amber-400",
        className
      )}
    >
      {children}
    </span>
  );
}
