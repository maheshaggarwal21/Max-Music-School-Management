"use client";
// A1 — quick-action launcher cards on the dashboard landing. Gives non-technical
// admins the core operations up front instead of hunting through tabs.
// WHITE-LABEL: brand accent comes from the institution's CSS vars only.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BlurFade } from "@maxmusic/ui";

export interface QuickAction {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <BlurFade delay={0.05}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
              <a.icon className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm font-semibold leading-tight">{a.label}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{a.hint}</span>
          </Link>
        ))}
      </div>
    </BlurFade>
  );
}
