"use client";
import { useRef } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

export function BlurFade({
  children, className, duration = 0.4, delay = 0,
  offset = 6, direction = "down", inView = false,
  inViewMargin = "-50px", blur = "6px",
}: {
  children: React.ReactNode; className?: string; duration?: number;
  delay?: number; offset?: number; direction?: "up"|"down"|"left"|"right";
  inView?: boolean; inViewMargin?: string; blur?: string;
}) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as `${number}px` });
  const isInView = !inView || inViewResult;

  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const sign = direction === "right" || direction === "down" ? -offset : offset;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ [axis]: sign, opacity: 0, filter: `blur(${blur})` }}
        animate={isInView ? { [axis]: 0, opacity: 1, filter: "blur(0px)" } : {}}
        exit={{ [axis]: sign, opacity: 0, filter: `blur(${blur})` }}
        transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
