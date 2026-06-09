"use client";
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";
import { SpotlightCard } from "./spotlight-card";
import { BorderBeam } from "./border-beam";
import { CountUp } from "./count-up";

export interface StatsCardProps {
  label: string;
  value: number | React.ReactNode;
  icon?: LucideIcon;
  trend?: string;
  className?: string;
}

export function StatsCard({ label, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <SpotlightCard className={cn(
      "relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1",
      className
    )}>
      <BorderBeam size={40} duration={12} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 text-4xl font-bold">
            {typeof value === "number" ? <CountUp to={value} /> : value}
          </div>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        {Icon && (
          <div className="rounded-xl bg-brand/10 p-3">
            <Icon className="h-5 w-5 text-brand" />
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
