"use client";
import React from "react";
import { theme } from "@maxmusic/ui/lib/theme";

export function StarBorder<T extends React.ElementType = "button">({
  as, className = "", color = theme.colors.ui.starBorder,
  speed = "6s", thickness = 1, children, ...rest
}: React.ComponentPropsWithoutRef<T> & {
  as?: T; color?: string; speed?: string; thickness?: number;
}) {
  const C = (as || "button") as React.ElementType;
  return (
    <C className={`relative inline-block overflow-hidden rounded-full ${className}`}
      style={{ padding: `${thickness}px 0` }} {...(rest as object)}
    >
      <div className="absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-70 animate-star-movement-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <div className="absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] rounded-full opacity-70 animate-star-movement-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <div className="relative z-[1] rounded-full border border-foreground/[0.1] bg-gradient-to-b from-foreground/[0.07] to-foreground/[0.03] px-6 py-2.5 text-center">
        {children}
      </div>
    </C>
  );
}
