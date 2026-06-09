import type { LucideIcon } from "lucide-react";
import { BorderBeam, GradientText } from "@maxmusic/ui";

/** Consistent empty state: icon + heading + helper text + optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card px-6 py-16 text-center shadow-sm">
      <BorderBeam size={60} duration={10} />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
        <Icon className="h-7 w-7 text-brand" />
      </div>
      <GradientText className="mt-4 text-lg font-semibold">{title}</GradientText>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
