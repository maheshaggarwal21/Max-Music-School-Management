"use client";
// Local workaround: shared CountUp formats with en-US grouping only.
// This animates a paise amount with Indian digit grouping. The ₹ symbol is
// rendered as a separate baseline-aligned span (outside the animated text
// node) so it never re-wraps or repaints during the count-up, and the digits
// use tabular-nums + nowrap so the card layout stays stable every frame.
// Report: candidate to upstream into packages/ui.

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

function formatIndian(paise: number): string {
  const rupees = Math.round(paise / 100);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.abs(rupees));
  return `${rupees < 0 ? "-" : ""}${formatted}`;
}

export function CurrencyCountUp({
  to,
  delay = 0,
  duration = 1.6,
  className = "",
}: {
  /** Amount in paise. */
  to: number;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const sv = useSpring(mv, {
    damping: 18 + 16 / duration,
    stiffness: 180 / duration,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      const t = window.setTimeout(() => mv.set(to), delay * 1000);
      return () => window.clearTimeout(t);
    }
  }, [isInView, mv, to, delay]);

  useEffect(() => {
    const unsub = sv.on("change", (v: number) => {
      if (ref.current) ref.current.textContent = formatIndian(v);
    });
    return () => unsub();
  }, [sv]);

  return (
    <span
      className={`inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums ${className}`}
    >
      <span className="text-[0.65em] font-semibold text-muted-foreground">₹</span>
      <span ref={ref}>{formatIndian(0)}</span>
    </span>
  );
}
