"use client";
// Topbar: theme toggle + avatar menu (profile → settings, sign out).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar, cn, useThemeTransition } from "@maxmusic/ui";
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const signOut = async () => {
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {today}
      </p>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={(e) => toggleTheme(e)}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Avatar menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={operator?.name ?? "Operator"} size="sm" />
            <span className="hidden text-sm font-medium sm:block">
              {operator?.name ?? "…"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
                role="menu"
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
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
