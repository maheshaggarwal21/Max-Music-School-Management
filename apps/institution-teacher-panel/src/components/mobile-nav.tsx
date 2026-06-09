"use client";
// Mobile-first bottom tab bar — teachers mark attendance on phones.
// Large tap targets (min 48px), safe-area aware, brand color from CSS vars only.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@maxmusic/ui";

export interface MobileNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function MobileNav({
  items,
  activeHref,
}: {
  items: MobileNavItem[];
  activeHref?: string;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                isActive ? "text-brand" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-brand" />
              )}
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
