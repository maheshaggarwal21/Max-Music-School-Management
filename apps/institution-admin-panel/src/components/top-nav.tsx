"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Avatar, GradientText, useThemeTransition } from "@maxmusic/ui";

// Top bar of the admin panel. Sits INSIDE the content column (to the right of
// the sidebar — it never overlaps it). WHITE-LABEL: the only identity here is
// the institution's logo/name and the signed-in admin.

export interface TopNavProps {
  adminName: string;
  schoolName: string;
  logoUrl: string | null;
}

export function TopNav({ adminName, schoolName, logoUrl }: TopNavProps) {
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm">
      {/* Left: page identity + greeting */}
      <div className="min-w-0">
        <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
        <p className="truncate text-xs text-muted-foreground">
          Welcome back, <span className="font-medium text-brand">{adminName}</span>
        </p>
      </div>

      {/* Right: theme toggle · institution logo · admin name (animated gradient) */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={(e) => toggleTheme(e)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {mounted && resolvedTheme === "dark"
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />}
        </button>

        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={schoolName} className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
            {schoolName.trim().charAt(0).toUpperCase() || "•"}
          </span>
        )}

        {/* Admin name box — animated gradient text ("AI Architect" effect),
            colors driven by the institution's brand var (white-label). */}
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-1.5 shadow-sm">
          <Avatar name={adminName} size="sm" />
          <GradientText
            className="text-sm font-semibold"
            colors={["var(--brand-primary)", "#8b5cf6", "var(--brand-primary)"]}
            animationSpeed={6}
          >
            {adminName}
          </GradientText>
        </div>
      </div>
    </header>
  );
}
