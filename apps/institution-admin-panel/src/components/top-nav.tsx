"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { Avatar, cn, GradientText, useThemeTransition } from "@maxmusic/ui";

// Top bar of the admin panel. Sits INSIDE the content column (to the right of
// the sidebar — it never overlaps it). WHITE-LABEL: the only identity here is
// the institution's logo/name and the signed-in admin.
//
// The admin pill is a functional dropdown (account info · Settings · Sign out),
// PORTALED to document.body with fixed coords so it floats above the animated
// page content and stays clickable (same pattern as the operator topbar).

export interface TopNavProps {
  adminName: string;
  schoolName: string;
  logoUrl: string | null;
  settingsHref: string;
  onSignOut: () => void;
}

export function TopNav({ adminName, schoolName, logoUrl, settingsHref, onSignOut }: TopNavProps) {
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

  return (
    <header className="hidden shrink-0 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm md:flex">
      {/* Left: page identity + greeting */}
      <div className="min-w-0">
        <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
        <p className="truncate text-xs text-muted-foreground">
          Welcome back, <span className="font-medium text-brand">{adminName}</span>
        </p>
      </div>

      {/* Right: theme toggle · institution logo · admin menu (animated gradient) */}
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

        {/* Admin pill — opens the account menu. Animated gradient name
            ("AI Architect" effect), colors driven by the institution brand. */}
        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-1.5 shadow-sm transition-colors hover:bg-foreground/[0.04]"
        >
          <Avatar name={adminName} size="sm" />
          <GradientText
            className="hidden text-sm font-semibold sm:block"
            colors={["var(--brand-primary)", "#8b5cf6", "var(--brand-primary)"]}
            animationSpeed={6}
          >
            {adminName}
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
                    <p className="truncate text-sm font-semibold">{adminName}</p>
                    <p className="truncate text-xs text-muted-foreground">Administrator</p>
                  </div>
                  <div className="p-1">
                    <Link
                      href={settingsHref}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSignOut();
                      }}
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
