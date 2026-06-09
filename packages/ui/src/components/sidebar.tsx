"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useThemeTransition } from "./use-theme-transition";
import {
  LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun, type LucideIcon,
} from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";
import { theme } from "@maxmusic/ui/lib/theme";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface SidebarSection {
  label: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  /**
   * WHITE-LABEL: render ONLY what is passed here. Operator panel passes its own
   * neutral console name; institution panels pass Institution.branding.schoolName.
   * Never hardcode any operator/Max-Music identifier inside this component.
   */
  brandName: string;
  logoUrl?: string | null;
  sections: SidebarSection[];
  activeHref?: string;
  footer?: React.ReactNode;
  onSignOut?: () => void;
  defaultExpanded?: boolean;
  className?: string;
}

export function Sidebar({
  brandName, logoUrl, sections, activeHref, footer, onSignOut,
  defaultExpanded = true, className,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        expanded ? "w-60" : "w-16",
        className
      )}
    >
      {/* Brand header — institution name/logo ONLY (white-label) */}
      <div className={cn("flex items-center gap-3 px-3 py-4", !expanded && "justify-center px-0")}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
            {brandName.trim().charAt(0).toUpperCase() || "•"}
          </span>
        )}
        {expanded && (
          <span className="truncate text-sm font-semibold">{brandName}</span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-4 overflow-y-auto no-scrollbar px-2 py-2">
        {sections.map((section) => (
          <div key={section.label}>
            {expanded && (
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
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
                    {/* Brand left accent bar — ONLY on active item */}
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
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer slot + controls */}
      <div className="space-y-1 border-t border-sidebar-border p-2">
        {footer}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={(e) => toggleTheme(e)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/60 transition-all duration-200 hover:bg-foreground/[0.05] hover:text-sidebar-foreground",
            expanded ? "px-3" : "justify-center px-0"
          )}
        >
          {mounted && resolvedTheme === "dark"
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />}
          {expanded && <span>{mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/60 transition-all duration-200 hover:bg-foreground/[0.05] hover:text-sidebar-foreground",
            expanded ? "px-3" : "justify-center px-0"
          )}
        >
          {expanded ? <PanelLeftClose className="h-4 w-4 shrink-0" /> : <PanelLeftOpen className="h-4 w-4 shrink-0" />}
          {expanded && <span>Collapse</span>}
        </button>

        {/* Sign out */}
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-destructive/80 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive",
              expanded ? "px-3" : "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {expanded && <span>Sign out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
