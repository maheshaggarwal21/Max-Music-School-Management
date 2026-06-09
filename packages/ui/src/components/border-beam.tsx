"use client";
import { motion, type MotionStyle } from "motion/react";
import { cn } from "@maxmusic/ui/lib/utils";
import { theme } from "@maxmusic/ui/lib/theme";

export const BorderBeam = ({
  size = 50, delay = 0, duration = 6,
  colorFrom = theme.colors.ui.borderBeamFrom,
  colorTo = theme.colors.ui.borderBeamTo,
  reverse = false, initialOffset = 0, borderWidth = 1,
  className, style,
}: {
  size?: number; delay?: number; duration?: number;
  colorFrom?: string; colorTo?: string; reverse?: boolean;
  initialOffset?: number; borderWidth?: number;
  className?: string; style?: React.CSSProperties;
}) => (
  <div
    className="pointer-events-none absolute inset-0 rounded-[inherit]
      border-(length:--border-beam-width) border-transparent
      mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)]
      mask-intersect [mask-clip:padding-box,border-box]"
    style={{ "--border-beam-width": `${borderWidth}px` } as React.CSSProperties}
  >
    <motion.div
      className={cn("absolute aspect-square bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent", className)}
      style={{
        width: size,
        offsetPath: `rect(0 auto auto 0 round ${size}px)`,
        "--color-from": colorFrom,
        "--color-to": colorTo,
        ...style,
      } as MotionStyle}
      initial={{ offsetDistance: `${initialOffset}%` }}
      animate={{ offsetDistance: reverse
        ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
        : [`${initialOffset}%`, `${100 + initialOffset}%`]
      }}
      transition={{ repeat: Infinity, ease: "linear", duration, delay: -delay }}
    />
  </div>
);
