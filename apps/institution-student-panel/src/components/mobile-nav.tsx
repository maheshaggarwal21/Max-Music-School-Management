"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { cn, useThemeTransition } from "@maxmusic/ui";
import type { BrandingPublic } from "@/lib/types";
import { NAV_SECTIONS } from "./nav-items";

/**
 * Mobile top bar + slide-over drawer (md:hidden). Brand identity comes ONLY
 * from the institution's BrandingPublic (white-label).
 */
export function MobileNav({
  branding,
  onSignOut,
}: {
  branding: BrandingPublic;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // close the drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  const initial = branding.schoolName.trim().charAt(0).toUpperCase() || "•";

  return (
    <>
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.schoolName}
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
              {initial}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{branding.schoolName}</span>
        </div>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
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
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-2xl md:hidden"
            >
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                    {initial}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {branding.schoolName}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
                {NAV_SECTIONS.flatMap((s) => s.items).map((item) => {
                  const Icon = item.icon;
                  const href = `/${slug}/student${item.href}`;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-brand/10 text-brand"
                          : "text-sidebar-foreground/60 hover:bg-foreground/[0.05] hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="space-y-1 border-t border-sidebar-border p-2">
                <button
                  type="button"
                  onClick={(e) => toggleTheme(e)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-all hover:bg-foreground/[0.05] hover:text-sidebar-foreground"
                >
                  {mounted && resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 transition-all hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
