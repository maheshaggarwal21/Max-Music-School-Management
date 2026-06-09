"use client";
import type { LucideIcon } from "lucide-react";
import { BorderBeam, GradientText } from "@maxmusic/ui";

/** Designed empty state — icon halo, gradient heading, hint, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card/50 px-6 py-14">
      <BorderBeam size={60} duration={12} />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
          <Icon className="h-6 w-6 text-brand" />
        </div>
        <GradientText className="text-lg font-semibold">{title}</GradientText>
        {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
