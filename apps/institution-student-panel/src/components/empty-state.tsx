"use client";
import type { LucideIcon } from "lucide-react";
import { BlurFade, GradientText } from "@maxmusic/ui";

/** Polished, warm empty state used across pages. */
export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <BlurFade delay={0.1}>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <div className="rounded-2xl bg-brand/10 p-4">
          <Icon className="h-7 w-7 text-brand" />
        </div>
        <GradientText className="text-lg font-semibold">{title}</GradientText>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </BlurFade>
  );
}
