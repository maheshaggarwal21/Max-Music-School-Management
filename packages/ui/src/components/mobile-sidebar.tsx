"use client";
// Mobile navigation for panels that use the in-flow desktop <Sidebar>.
// Renders a sticky top bar (hamburger) + a slide-over drawer — BOTH md:hidden,
// so on desktop the normal <Sidebar className="hidden md:flex"> takes over and
// this renders nothing visible. Mirrors the Sidebar's section/active-link look.
//
// WHITE-LABEL: render ONLY what is passed via brandName / logoUrl. The operator
// passes its neutral console name; institution panels pass the institution's
// BrandingPublic. Never hardcode any operator/Max-Music identifier here.

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { cn } from "@maxmusic/ui/lib/utils";
import { theme } from "@maxmusic/ui/lib/theme";
import { useThemeTransition } from "./use-theme-transition";
import type { SidebarSection } from "./sidebar";

export interface MobileSidebarProps {
  brandName: string;
  logoUrl?: string | null;
  sections: SidebarSection[];
  activeHref?: string;
  footer?: React.ReactNode;
  onSignOut?: () => void;
  /** Extra controls rendered on the right of the top bar (before the menu button). */
  rightSlot?: React.ReactNode;
  className?: string;
}

export function MobileSidebar({
  brandName,
  logoUrl,
  sections,
  activeHref,
  footer,
  onSignOut,
  rightSlot,
  className,
}: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const initial = brandName.trim().charAt(0).toUpperCase() || "•";

  const Brand = (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={brandName}
          className="h-8 w-8 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
          {initial}
        </span>
      )}
      <span className="truncate text-sm font-semibold">{brandName}</span>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — hidden once the desktop sidebar appears */}
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden",
          className
        )}
      >
        {Brand}
        <div className="flex shrink-0 items-center gap-1.5">
          {rightSlot}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between gap-2 px-4 py-4">
                {Brand}
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-4 overflow-y-auto no-scrollbar px-2 py-2">
                {sections.map((section) => (
                  <div key={section.label}>
                    <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
                      {section.label}
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeHref === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-brand/10 text-brand"
                                : "text-sidebar-foreground/60 hover:bg-foreground/[0.05] hover:text-sidebar-foreground"
                            )}
                            style={{ boxShadow: isActive ? theme.shadows.accentGlowSm : undefined }}
                          >
                            {isActive && (
                              <span
                                className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                                style={{ boxShadow: theme.shadows.brandGlow }}
                              />
                            )}
                            <Icon
                              className={cn(
                                "h-4 w-4 shrink-0 transition-colors duration-200",
                                isActive
                                  ? "text-brand"
                                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="space-y-1 border-t border-sidebar-border p-2">
                {footer}

                <button
                  type="button"
                  onClick={(e) => toggleTheme(e)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-all duration-200 hover:bg-foreground/[0.05] hover:text-sidebar-foreground"
                >
                  {mounted && resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4 shrink-0" />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0" />
                  )}
                  <span>{mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>

                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span>Sign out</span>
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
