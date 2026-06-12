"use client";
// Topbar: theme toggle + avatar menu (profile → settings, sign out).
// The avatar menu is PORTALED to document.body with fixed coords so it floats
// above (and stays clickable over) the animated <BlurFade> content below — an
// in-flow absolute menu gets its lower items intercepted by those stacking
// contexts. Same pattern as the row-actions "⋯" menu.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar, cn, GradientText, useThemeTransition } from "@maxmusic/ui";
import { api, mockable } from "@/lib/api";
import { mockLogout } from "@/lib/mocks";
import { useOperatorSession } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export function Topbar() {
  const router = useRouter();
  const operator = useOperatorSession();
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (btnRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    setMenuOpen((v) => !v);
  };

  const signOut = async () => {
    setMenuOpen(false);
    try {
      await mockable(
        () => api.post<ApiResponse<null>>("/api/auth/operator/logout", {}),
        mockLogout()
      );
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  };

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="hidden h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md md:flex">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {today}
      </p>

      <div className="flex shrink-0 items-center gap-3">
        {/* Theme toggle — bordered square (matches institution admin top-nav) */}
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={(e) => toggleTheme(e)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Avatar menu — pill with animated gradient name (matches admin top-nav) */}
        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-1.5 shadow-sm transition-colors hover:bg-foreground/[0.04]"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={operator?.name ?? "Operator"} size="sm" />
          <GradientText
            className="hidden text-sm font-semibold sm:block"
            colors={["#5B8DEF", "#8b5cf6", "#5B8DEF"]}
            animationSpeed={6}
          >
            {operator?.name ?? "…"}
          </GradientText>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {mounted &&
          createPortal(
            <AnimatePresence>
              {menuOpen && pos && (
                <motion.div
                  ref={menuRef}
                  role="menu"
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{ top: pos.top, right: pos.right, zIndex: 9999 }}
                  className="fixed w-56 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold">{operator?.name ?? "Operator"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {operator?.email ?? ""}
                    </p>
                  </div>
                  <div className="p-1">
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </div>
    </header>
  );
}
