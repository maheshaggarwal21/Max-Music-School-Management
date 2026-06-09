# Frontend Agent
> Identity: You are the Frontend Agent. You own all Next.js apps and the shared UI package.
> This file defines the FULL design system, animation library, and component standards
> extracted from the BoltClaw reference codebase — apply every pattern here to every panel.
> Brand color is Steel Blue #5B8DEF. There is NO pink anywhere.

---

## YOUR DOMAIN

```
apps/admin-panel/
apps/teacher-panel/
apps/student-panel/
apps/institution-admin-panel/   (Phase 6)
apps/institution-teacher-panel/
apps/institution-student-panel/
packages/ui/                    ← Build ALL shared components here first
packages/utils/
```

---

## BEFORE YOU START EVERY TASK

1. Read `.claude/CLAUDE.md` — current phase and hard rules
2. Read `.claude/orchestrate/tasks.md` — pick the first ⬜ task assigned to you
3. Read `.claude/CONTRACTS.md` — confirm exact API response shapes before writing any fetch call
4. Backend endpoint must be ✅ in tasks.md before you wire it in the frontend

---

## DEPENDENCIES — INSTALL EXACTLY THESE

```json
{
  "dependencies": {
    "motion": "^12.0.0",
    "lucide-react": "^0.574.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "next-themes": "^0.4.6",
    "radix-ui": "^1.4.3",
    "sonner": "^2.0.7",
    "recharts": "^3.7.0"
  },
  "devDependencies": {
    "shadcn": "^3.8.5",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.4.0"
  }
}
```

**Library import rules (non-negotiable):**
- `motion` NOT `framer-motion` — import as `import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from "motion/react"`
- `radix-ui` — import as `import { Slot } from "radix-ui"` (NOT `@radix-ui/react-slot`)
- All icons from `lucide-react`
- `shadcn` for base component scaffolding only

---

## DESIGN SYSTEM — SINGLE SOURCE OF TRUTH

### Aesthetic target
Apple / Linear / Vercel dashboard quality. Clean, minimal, professional.
- Pure warm off-white backgrounds, never harsh white `#ffffff`
- Deep charcoal text, never pure black
- Steel Blue `#5B8DEF` as the ONLY brand accent — no pink, no purple, no gradients except within the steel-blue family
- Subtle glows and border beams, not bright neons
- `Inter` font, weight 400/500/600 only

---

### theme.ts — create at packages/ui/src/lib/theme.ts

```typescript
// Single source of truth for all brand colors.
// Import from here — never hardcode hex in components.
export const theme = {
  colors: {
    brand: {
      primary: "#5B8DEF",        // Steel Blue — the ONLY brand accent
      primaryLight: "#7BA3F3",
      primaryDark: "#4A7ADE",
      primaryDeep: "#3968C7",
      primaryHover: "#6B97F1",
      primaryLightHover: "#8BB0F5",
      accent: "#5B8DEF",
      accentLight: "#7BA3F3",
    },
    status: {
      success: "#34d399",
      successGlow: "rgba(52, 211, 153, 0.12)",
      warning: "#f97316",
      error: "#ef4444",
      info: "#5B8DEF",
      neutral: "#706f70",
    },
    ui: {
      borderBeamFrom: "#5B8DEF",
      borderBeamTo: "#3968C7",
      spotlight: "rgba(255, 255, 255, 0.25)",
      starBorder: "rgba(91, 141, 239, 0.8)",
      gridBorder: "rgba(91, 141, 239, 0.08)",
      gridHover: "rgba(91, 141, 239, 0.03)",
      vignetteLight: "#ebedf1",
      vignetteLightTransparent: "rgba(235, 237, 241, 0)",
      vignetteDark: "#080808",
      vignetteDarkTransparent: "rgba(8, 8, 8, 0)",
    },
    glow: {
      accent06: "rgba(91,141,239,0.06)",
      accent08: "rgba(91,141,239,0.08)",
      accent15: "rgba(91,141,239,0.15)",
      accent25: "rgba(91,141,239,0.25)",
      accent50: "rgba(91,141,239,0.50)",
    },
    text: {
      muted: "#acadb1",
      secondary: "#706f70",
      dark: "#353536",
      white: "#ebedf1",
    },
    grey: {
      50: "#ebedf1",
      100: "#d4d8df",
      200: "#acadb1",
      300: "#706f70",
      400: "#353536",
      500: "#080808",
    },
  },
  shadows: {
    brandGlow: "0 0 6px rgba(91, 141, 239, 0.5)",
    glowSm: "0 0 20px rgba(91, 141, 239, 0.3)",
    glowLg: "0 0 40px rgba(91, 141, 239, 0.5), 0 0 80px rgba(91, 141, 239, 0.15)",
    accentGlowXs: "0 0 6px rgba(91,141,239,0.4)",
    accentGlowSm: "0 0 12px rgba(91,141,239,0.08)",
    accentGlowMd: "0 0 16px rgba(91,141,239,0.25)",
    cardHover: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(91,141,239,0.1)",
  },
  gradients: {
    brand: ["#5B8DEF", "#7BA3F3", "#4A7ADE", "#3968C7", "#5B8DEF"],
    brandText: ["#5B8DEF", "#7BA3F3", "#4A7ADE"],
  },
} as const;
```

---

### globals.css — full CSS variables + all animation keyframes

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-muted: var(--brand-muted);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --animate-marquee: marquee var(--duration) infinite linear;
  --animate-marquee-vertical: marquee-vertical var(--duration) linear infinite;
  @keyframes marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(calc(-100% - var(--gap))); }
  }
  @keyframes marquee-vertical {
    from { transform: translateY(0); }
    to   { transform: translateY(calc(-100% - var(--gap))); }
  }
}

/* ── LIGHT MODE ── */
:root {
  /* Brand: Steel Blue — ONLY brand accent, no pink */
  --brand-primary: #5B8DEF;
  --brand-primary-light: #7BA3F3;
  --brand-primary-dark: #4A7ADE;
  --brand-primary-deep: #3968C7;
  --brand-primary-hover: #6B97F1;
  --brand-primary-light-hover: #8BB0F5;
  --brand-accent: #5B8DEF;
  --brand-accent-light: #7BA3F3;

  --radius: 0.625rem;

  --shadow-brand-glow: 0 0 6px rgba(91, 141, 239, 0.5);
  --glow-primary-sm: 0 0 20px rgba(91, 141, 239, 0.3);
  --glow-primary-lg: 0 0 40px rgba(91, 141, 239, 0.5), 0 0 80px rgba(91, 141, 239, 0.15);
  --gradient-brand-hover: linear-gradient(135deg,
    var(--brand-primary-light), var(--brand-primary), var(--brand-accent));

  /* Surfaces: warm off-white, not harsh white */
  --background: oklch(0.985 0.008 75);
  --foreground: oklch(0.22 0.01 50);
  --primary: oklch(0.22 0.01 50);
  --primary-foreground: oklch(0.985 0.008 75);
  --secondary: oklch(0.95 0.012 75);
  --secondary-foreground: oklch(0.25 0.01 50);
  --muted: oklch(0.94 0.01 75);
  --muted-foreground: oklch(0.52 0.01 50);
  --accent: oklch(0.65 0.16 260);    /* Steel Blue */
  --accent-foreground: oklch(0.98 0 0);
  --brand: oklch(0.65 0.16 260);
  --brand-foreground: oklch(0.98 0 0);
  --brand-muted: oklch(0.92 0.04 260);
  --card: oklch(0.995 0.005 75);
  --card-foreground: oklch(0.22 0.01 50);
  --popover: oklch(0.995 0.005 75);
  --popover-foreground: oklch(0.22 0.01 50);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.895 0.01 75);
  --input: oklch(0.895 0.01 75);
  --ring: oklch(0.65 0.16 260);
  --sidebar: oklch(0.96 0.005 75);
  --sidebar-foreground: oklch(0.25 0.01 50);
  --sidebar-primary: oklch(0.65 0.16 260);
  --sidebar-primary-foreground: oklch(0.96 0 0);
  --sidebar-accent: oklch(0.92 0.008 75);
  --sidebar-accent-foreground: oklch(0.25 0.01 50);
  --sidebar-border: oklch(0.895 0.01 75);
  --sidebar-ring: oklch(0.65 0.16 260);
}

/* ── DARK MODE ── */
.dark {
  --shadow-brand-glow: 0 0 8px rgba(91, 141, 239, 0.6);
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.96 0 0);
  --primary: oklch(0.96 0 0);
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.22 0 0);
  --secondary-foreground: oklch(0.96 0 0);
  --muted: oklch(0.22 0 0);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.65 0.16 260);
  --accent-foreground: oklch(0.10 0 0);
  --brand: oklch(0.65 0.16 260);
  --brand-foreground: oklch(0.10 0 0);
  --brand-muted: oklch(0.22 0.06 260);
  --card: oklch(0.19 0 0);
  --card-foreground: oklch(0.96 0 0);
  --popover: oklch(0.19 0 0);
  --popover-foreground: oklch(0.96 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.65 0.16 260);
  --sidebar: oklch(0.12 0 0);
  --sidebar-foreground: oklch(0.92 0 0);
  --sidebar-primary: oklch(0.65 0.16 260);
  --sidebar-primary-foreground: oklch(0.10 0 0);
  --sidebar-accent: oklch(0.18 0.01 260);
  --sidebar-accent-foreground: oklch(0.92 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.65 0.16 260);
}

/* ── ANIMATION KEYFRAMES ── */

@keyframes star-movement-bottom {
  0%   { transform: translate(0%, 0%); opacity: 1; }
  100% { transform: translate(-100%, 0%); opacity: 0; }
}
@keyframes star-movement-top {
  0%   { transform: translate(0%, 0%); opacity: 1; }
  100% { transform: translate(100%, 0%); opacity: 0; }
}
@utility animate-star-movement-bottom {
  animation: star-movement-bottom linear infinite alternate;
}
@utility animate-star-movement-top {
  animation: star-movement-top linear infinite alternate;
}

@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@utility animate-gradient-text {
  background-image: linear-gradient(to right,
    var(--brand-primary), var(--brand-accent),
    var(--brand-accent-light), var(--brand-primary-light), var(--brand-primary));
  background-size: 300% 100%;
  animation: gradient-shift 5s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes orbit {
  0%   { transform: rotate(calc(var(--angle) * 1deg)) translateX(calc(var(--radius) * 1px)) rotate(calc(var(--angle) * -1deg)); }
  100% { transform: rotate(calc(var(--angle) * 1deg + 360deg)) translateX(calc(var(--radius) * 1px)) rotate(calc((var(--angle) * -1deg) - 360deg)); }
}
@utility animate-orbit {
  animation: orbit calc(var(--duration) * 1s) linear infinite;
}

@keyframes grid-square-fade {
  0%, 100% { opacity: 0; }
  50%       { opacity: var(--grid-square-opacity, 0.5); }
}
@utility animate-grid-square {
  opacity: 0;
  animation: grid-square-fade linear infinite;
}

@keyframes shiny-text-sweep {
  0%   { background-position: 150% center; }
  100% { background-position: -50% center; }
}
@keyframes shiny-text-yoyo {
  0%   { background-position: 150% center; }
  50%  { background-position: -50% center; }
  100% { background-position: 150% center; }
}
@keyframes gradient-position-h-yoyo {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes chatFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes chatCursorBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@layer base {
  * { @apply border-border; }
  *:focus-visible { @apply outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

---

## ANIMATION COMPONENTS — BUILD ALL IN packages/ui/src/components/

### BlurFade — scroll-triggered entrance (use on EVERY page section)

```typescript
// blur-fade.tsx
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
```

**Rule: Every page section gets `<BlurFade inView delay={n}>`. Stagger siblings 0.1s apart.**

---

### BorderBeam — moving glow border (use on EVERY card and table)

```typescript
// border-beam.tsx
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
```

**Rule: Every `<div className="...card...">` gets `<BorderBeam />` as first child.
Use `size={60} duration={8}` on tables, `size={40} duration={12}` on stat cards.**

---

### SpotlightCard — mouse-tracked radial glow

```typescript
// spotlight-card.tsx
"use client";
import React, { useRef, useCallback } from "react";
import { theme } from "@maxmusic/ui/lib/theme";

export function SpotlightCard({
  children, className = "",
  spotlightColor = theme.colors.ui.spotlight,
}: React.PropsWithChildren<{ className?: string; spotlightColor?: string }>) {
  const divRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || !glowRef.current) return;
    const r = divRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    glowRef.current.style.background =
      `radial-gradient(circle at ${x}px ${y}px, ${spotlightColor}, transparent 80%)`;
  }, [spotlightColor]);

  const show = useCallback(() => { if (glowRef.current) glowRef.current.style.opacity = "0.6"; }, []);
  const hide = useCallback(() => { if (glowRef.current) glowRef.current.style.opacity = "0"; }, []);

  return (
    <div ref={divRef} onMouseMove={onMove} onMouseEnter={show}
      onMouseLeave={hide} onFocus={show} onBlur={hide}
      className={`relative overflow-hidden ${className}`}
    >
      <div ref={glowRef}
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out"
        style={{ opacity: 0 }}
      />
      {children}
    </div>
  );
}
```

**Rule: Wrap every StatsCard and feature card with `<SpotlightCard>`.**

---

### ShinyText — sweeping light effect on muted text

```typescript
// shiny-text.tsx
"use client";
import { theme } from "@maxmusic/ui/lib/theme";

export function ShinyText({
  text, disabled = false, speed = 2, className = "",
  color = theme.colors.text.muted,
  shineColor = theme.colors.brand.accent,
  spread = 120, yoyo = false, delay = 0,
}: {
  text: string; disabled?: boolean; speed?: number; className?: string;
  color?: string; shineColor?: string; spread?: number;
  yoyo?: boolean; delay?: number;
}) {
  const animName = yoyo ? "shiny-text-yoyo" : "shiny-text-sweep";
  return (
    <span className={`inline-block ${className}`} style={{
      backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
      backgroundSize: "200% auto",
      WebkitBackgroundClip: "text", backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      animation: disabled ? "none" : `${animName} ${yoyo ? speed * 2 : speed}s linear ${delay}s infinite`,
    }}>
      {text}
    </span>
  );
}
```

**Usage:** Subtitle / metadata lines beneath page headings:
```tsx
<ShinyText text="47 students · 6 active batches" speed={4} />
```

---

### GradientText — animated steel-blue gradient heading

```typescript
// gradient-text.tsx
"use client";
import { theme } from "@maxmusic/ui/lib/theme";

export function GradientText({
  children, className = "",
  colors = [...theme.gradients.brandText],
  animationSpeed = 8, yoyo = true,
}: {
  children: React.ReactNode; className?: string;
  colors?: string[]; animationSpeed?: number; yoyo?: boolean;
}) {
  const gradient = [...colors, colors[0]].join(", ");
  const animName = yoyo ? "gradient-position-h-yoyo" : "gradient-position-h";
  return (
    <div className={`relative mx-auto flex max-w-fit items-center justify-center overflow-hidden ${className}`}>
      <div className="relative z-[2] inline-block bg-clip-text text-transparent" style={{
        backgroundImage: `linear-gradient(to right, ${gradient})`,
        backgroundSize: "300% 100%",
        animation: `${animName} ${animationSpeed}s ease infinite`,
        WebkitBackgroundClip: "text",
      }}>
        {children}
      </div>
    </div>
  );
}
```

**Usage:** Page section headers, empty state headings, dashboard titles.
```tsx
<GradientText className="text-2xl font-bold">Manage Students</GradientText>
```

---

### CountUp — spring-animated number on scroll

```typescript
// count-up.tsx
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
  const sv = useSpring(mv, { damping: 20 + 40 * (1/duration), stiffness: 100 * (1/duration) });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const fmt = useCallback((n: number) =>
    Intl.NumberFormat("en-US", { useGrouping: !!separator }).format(n)
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
```

---

### Marquee — infinite scroll ticker

```typescript
// marquee.tsx
import { ComponentPropsWithoutRef } from "react";
import { cn } from "@maxmusic/ui/lib/utils";

export function Marquee({
  className, reverse = false, pauseOnHover = false,
  children, vertical = false, repeat = 4, ...props
}: ComponentPropsWithoutRef<"div"> & {
  reverse?: boolean; pauseOnHover?: boolean;
  vertical?: boolean; repeat?: number;
}) {
  return (
    <div {...props} className={cn(
      "group flex [gap:var(--gap)] overflow-hidden p-2 [--duration:40s] [--gap:1rem]",
      { "flex-row": !vertical, "flex-col": vertical },
      className
    )}>
      {Array(repeat).fill(0).map((_, i) => (
        <div key={i} className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
          "animate-marquee flex-row": !vertical,
          "animate-marquee-vertical flex-col": vertical,
          "group-hover:[animation-play-state:paused]": pauseOnHover,
          "[animation-direction:reverse]": reverse,
        })}>
          {children}
        </div>
      ))}
    </div>
  );
}
```

---

### StarBorder — rotating star glow wrapper (for highlighted CTAs)

```typescript
// star-border.tsx
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
```

---

## BUTTON VARIANTS (packages/ui/src/components/button.tsx)

```typescript
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@maxmusic/ui/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium leading-normal transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",

        // THE PRIMARY CTA — steel-blue gradient + glow + scale on hover
        brand:
          "bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-primary-light)] to-[var(--brand-primary)] text-white font-semibold uppercase tracking-wide shadow-[var(--glow-primary-sm)] border border-[var(--brand-primary)]/20 hover:shadow-[var(--glow-primary-lg)] hover:from-[var(--brand-primary-hover)] hover:via-[var(--brand-primary-light-hover)] hover:to-[var(--brand-primary-hover)] hover:brightness-110 hover:scale-[1.02]",

        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md gap-1.5 px-3 py-1.5",
        lg: "min-h-10 rounded-md px-6 py-2.5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

**Primary CTA pattern — always this exact shape:**
```tsx
<Button variant="brand" size="lg" className="group h-12 rounded-full px-8 transition-all duration-300">
  Add Student
  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
</Button>
```

**Add-action buttons (Plus icon rotates 90° on hover):**
```tsx
<Button variant="brand" className="group rounded-full">
  Add Student
  <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
</Button>
```

---

## DATA TABLE (packages/ui/src/components/data-table.tsx)

```tsx
export function DataTable({ columns, data, loading, pagination, onRowClick }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <BorderBeam size={80} duration={10} />

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Steel-blue tinted header — NOT pink */}
          <thead>
            <tr className="border-b border-border bg-brand-muted/40">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-brand">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className="border-b border-border/50 transition-colors duration-150 hover:bg-muted/40 cursor-pointer"
              >
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          Page {pagination.page} of {pagination.pages} · {pagination.total} total
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="rounded-md p-1.5 transition-all hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="rounded-md p-1.5 transition-all hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## STATS CARD (packages/ui/src/components/stats-card.tsx)

```tsx
export function StatsCard({ label, value, icon: Icon, trend, className }) {
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
```

---

## STATUS BADGE (packages/ui/src/components/status-badge.tsx)

```tsx
// Steel-blue accent for institution mode badges; no pink
const variants = {
  active:      "bg-emerald-400/12 text-emerald-500 dark:text-emerald-400",
  pending:     "bg-amber-400/12 text-amber-500 dark:text-amber-400",
  inactive:    "bg-muted text-muted-foreground",
  paid:        "bg-emerald-400/12 text-emerald-500 dark:text-emerald-400",
  unpaid:      "bg-destructive/10 text-destructive",
  suspended:   "bg-destructive/10 text-destructive",
  terminated:  "bg-destructive/10 text-destructive",
  managed:     "bg-brand/10 text-brand",          // steel-blue badge
  autonomous:  "bg-violet-400/10 text-violet-500",
  trial:       "bg-amber-400/12 text-amber-500",
} as const;

const dot = {
  active: "bg-emerald-400", pending: "bg-amber-400", paid: "bg-emerald-400",
  inactive: "bg-muted-foreground", unpaid: "bg-destructive",
  suspended: "bg-destructive", terminated: "bg-destructive",
  managed: "bg-brand", autonomous: "bg-violet-400", trial: "bg-amber-400",
} as const;

export function StatusBadge({ status }: { status: keyof typeof variants }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border-0",
      variants[status]
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status] ?? "bg-muted-foreground")} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
```

---

## MODAL (packages/ui/src/components/modal.tsx)

```tsx
"use client";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { BorderBeam } from "./border-beam";

export function Modal({ open, onClose, title, subtitle, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <BorderBeam size={80} duration={8} />
              <div className="flex items-start justify-between p-6">
                <div>
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                <button onClick={onClose}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-6 pb-4">{children}</div>
              {footer && <div className="border-t border-border px-6 py-4 flex justify-end gap-2">{footer}</div>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## SIDEBAR PATTERN (apps/[panel]/src/components/sidebar.tsx)

Active nav item — left steel-blue accent bar + brand text + brand glow:

```tsx
<Link
  href={item.href}
  className={cn(
    "group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden",
    expanded ? "px-3" : "justify-center px-0",
    isActive
      ? "bg-brand/10 text-brand"
      : "text-sidebar-foreground/60 hover:bg-foreground/[0.05] hover:text-sidebar-foreground"
  )}
  style={{ boxShadow: isActive ? theme.shadows.accentGlowSm : undefined }}
>
  {/* Steel-blue left accent bar — ONLY on active item */}
  {isActive && (
    <span
      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand"
      style={{ boxShadow: theme.shadows.brandGlow }}
    />
  )}
  <Icon className={cn(
    "h-4 w-4 shrink-0 transition-colors duration-200",
    isActive
      ? "text-brand"
      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
  )} />
  <span className={cn(
    "truncate transition-all duration-300",
    expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
  )}>
    {item.label}
  </span>
</Link>

{/* Section label */}
{expanded && (
  <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
    {section.label}
  </div>
)}
```

**Sign-out button:**
```tsx
<button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive/80 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive">
  <LogOut className="h-4 w-4 shrink-0" />
  Sign out
</button>
```

---

## PAGE LAYOUT PATTERN — STANDARD DASHBOARD PAGE

Every dashboard page MUST follow this structure:

```tsx
export default function StudentsPage() {
  return (
    <div className="relative flex flex-col gap-6 p-6">

      {/* Ambient background glow — steel blue, very subtle */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.03] blur-[100px]"
          style={{ backgroundColor: theme.colors.brand.accent }}
        />
      </div>

      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <GradientText className="text-2xl font-bold">Students</GradientText>
            <ShinyText text="Manage enrolled students" speed={6} className="mt-1 text-sm" />
          </div>
          <Button variant="brand" className="group rounded-full">
            Add Student
            <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        </div>
      </BlurFade>

      {/* Stats row */}
      <BlurFade delay={0.1}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard label="Total" value={47} icon={Users} />
          <StatsCard label="Active" value={42} icon={UserCheck} />
          <StatsCard label="Pending" value={3} icon={Clock} />
          <StatsCard label="Inactive" value={2} icon={UserX} />
        </div>
      </BlurFade>

      {/* Main content */}
      <BlurFade delay={0.2}>
        <DataTable
          columns={columns} data={students}
          loading={loading} pagination={pagination}
          onRowClick={(row) => setSelected(row)}
        />
      </BlurFade>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)}
        title="Student Details" subtitle={selected?.name}
        footer={<Button variant="brand">Save Changes</Button>}
      >
        {/* form content */}
      </Modal>
    </div>
  );
}
```

---

## MULTI-STEP LOADING / PROVISIONING PATTERN

For institution creation, bulk operations, long async tasks:

```tsx
const STEPS = [
  { label: "Creating institution", icon: Building2 },
  { label: "Setting up panels", icon: LayoutDashboard },
  { label: "Sending credentials", icon: Mail },
  { label: "Activating services", icon: Zap },
];

function ProvisioningProgress({ step }: { step: number }) {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="text-center space-y-2">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
        <h2 className="text-xl font-semibold">Creating institution</h2>
        <p className="text-sm text-muted-foreground">This takes a few seconds</p>
      </div>
      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = step > i;
          const isActive = step === i;
          return (
            <div key={s.label} className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-all duration-500",
              isDone    ? "border-brand/30 bg-brand/5" :
              isActive  ? "border-brand/50 bg-brand/10" :
                          "border-border/40 bg-card/30 opacity-50"
            )}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
                {isDone    ? <CheckCircle2 className="h-4 w-4 text-brand" /> :
                 isActive  ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> :
                             <Icon className="h-4 w-4 text-muted-foreground" />}
              </div>
              <span className={cn("text-sm font-medium",
                isDone || isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## FLOATING GLASS CARD (banners / announcements)

```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.4, duration: 0.6, type: "spring", stiffness: 120, damping: 18 }}
  className="relative rounded-2xl border border-foreground/[0.08] bg-card/80 px-5 py-4 backdrop-blur-md
    transition-shadow duration-200 hover:shadow-lg"
  style={{ boxShadow: theme.shadows.accentGlowSm }}
>
  <BorderBeam size={60} duration={5} />
  {/* content */}
</motion.div>
```

---

## INSTITUTION PANEL BRANDING OVERRIDE

Institution panels override CSS custom properties from server-side branding data.
This allows each institution to have its own accent color while ALL components
(buttons, sidebar active states, stat card icons, border beams, badges) automatically
adopt that color — because everything reads from `--brand-primary`.

```typescript
// apps/institution-admin-panel/src/app/layout.tsx
export default async function Layout({ children }) {
  const branding = await fetchInstitutionBranding();
  // Default to steel blue if no custom color set
  const primary = branding?.primaryColor ?? "#5B8DEF";

  // Compute related tones for full palette consistency
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{
        "--brand-primary": primary,
        "--brand-primary-light": primary + "dd",
        "--brand-primary-dark": primary + "aa",
        "--brand-primary-hover": primary,
        "--brand-accent": primary,
        "--brand-accent-light": primary + "dd",
        "--glow-primary-sm": `0 0 20px ${primary}4d`,
        "--glow-primary-lg": `0 0 40px ${primary}80, 0 0 80px ${primary}26`,
        "--shadow-brand-glow": `0 0 6px ${primary}80`,
      } as React.CSSProperties}>
        {children}
      </body>
    </html>
  );
}
```

---

## API CLIENT (apps/[panel]/src/lib/api.ts)

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1/admin";

class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",  // sends httpOnly cookie — always required
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok) {
      if (res.status === 401) window.location.href = "/login";
      throw new Error((await res.json()).message || "API error");
    }
    return res.json();
  }
  get<T>(ep: string) { return this.request<T>(ep); }
  post<T>(ep: string, b: unknown) { return this.request<T>(ep, { method: "POST", body: JSON.stringify(b) }); }
  put<T>(ep: string, b: unknown) { return this.request<T>(ep, { method: "PUT", body: JSON.stringify(b) }); }
  delete<T>(ep: string) { return this.request<T>(ep, { method: "DELETE" }); }
}
export const api = new ApiClient();
```

---

## NEXT.JS APP TEMPLATE

```typescript
// apps/[panel]/src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## HARD RULES — NEVER VIOLATE

- **Never** use `localStorage` — cookies only (`credentials: "include"`)
- **Never** hardcode API URLs — always `process.env.NEXT_PUBLIC_API_URL`
- **Never** import from `framer-motion` — always `motion/react`
- **Never** import from `@radix-ui/react-slot` — always `radix-ui`
- **Never** use `#e91e8c` or any pink/magenta color — brand is Steel Blue `#5B8DEF`
- **Always** wrap page sections in `<BlurFade inView delay={n}>`
- **Always** put `<BorderBeam />` as first child of every card
- **Always** wrap stat cards in `<SpotlightCard>`
- **Always** use `<Modal>` with `AnimatePresence` — never a bare conditional render
- **Always** use the `api` client — never raw `fetch` in components

---

## AFTER COMPLETING A TASK

1. Mark task ✅ in tasks.md
2. Update codebase.md file status
3. If a backend endpoint isn't ready, mark BLOCKED in tasks.md with the exact route path
4. Never chain to the next task without confirming with the user
