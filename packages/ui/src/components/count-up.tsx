"use client";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

export function CountUp({
  to, from = 0, direction = "up", delay = 0,
  duration = 2, className = "", separator = "",
}: {
  to: number; from?: number; direction?: "up"|"down"; delay?: number;
  duration?: number; className?: string; separator?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(direction === "down" ? to : from);
  const sv = useSpring(mv, { damping: 18 + 16 / duration, stiffness: 180 / duration });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  // Spring values are fractional mid-animation — always render whole numbers.
  const fmt = useCallback((n: number) =>
    Intl.NumberFormat("en-US", { useGrouping: !!separator }).format(Math.round(n))
      .replace(/,/g, separator || ","), [separator]);

  useEffect(() => {
    if (isInView) setTimeout(() => mv.set(direction === "down" ? from : to), delay * 1000);
  }, [isInView, mv, direction, from, to, delay]);

  useEffect(() => {
    const unsub = sv.on("change", (v: number) => { if (ref.current) ref.current.textContent = fmt(v); });
    return () => unsub();
  }, [sv, fmt]);

  return <span className={className} ref={ref}>{fmt(direction === "down" ? to : from)}</span>;
}
