"use client";
// Animated tab switcher — steel-blue active pill via motion layoutId.

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@maxmusic/ui";

export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm",
        className
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
              isActive ? "text-brand" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="op-tab-pill"
                className="absolute inset-0 rounded-md bg-brand/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-[1] inline-flex items-center gap-1.5">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
