"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, LogOut, Moon, Sun, UserRound, Users } from "lucide-react";
import { Avatar, cn, GradientText, useThemeTransition } from "@maxmusic/ui";

// Top bar of the teacher panel. Sits in the content column (right of the
// sidebar). WHITE-LABEL: the only identity is the institution's logo/name and
// the signed-in teacher. Adds a Teachers button (roster + KPIs) next to the
// account menu. The account menu is PORTALED to document.body so it floats
// above the animated page content and stays clickable.

export interface TopNavProps {
  teacherName: string;
  schoolName: string;
  logoUrl: string | null;
  base: string; // "/<slug>/teacher"
  onSignOut: () => void;
}

export function TopNav({ teacherName, schoolName, logoUrl, base, onSignOut }: TopNavProps) {
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
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
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
      {/* Left: greeting / page identity */}
      <div className="min-w-0">
        <h1 className="text-lg font-bold leading-tight">Teacher Console</h1>
        <p className="truncate text-xs text-muted-foreground">
          Welcome back, <span className="font-medium text-brand">{teacherName}</span>
        </p>
      </div>

      {/* Right: Teachers · theme · logo · account menu */}
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href={`${base}/teachers`}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Teachers</span>
        </Link>

        <button
          type="button"
          aria-label="Toggle theme"
          onClick={(e) => toggleTheme(e)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={schoolName} className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
            {schoolName.trim().charAt(0).toUpperCase() || "•"}
          </span>
        )}

        <button
          ref={btnRef}
          type="button"
          onClick={toggleMenu}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-1.5 shadow-sm transition-colors hover:bg-foreground/[0.04]"
        >
          <Avatar name={teacherName} size="sm" />
          <GradientText
            className="hidden text-sm font-semibold sm:block"
            colors={["var(--brand-primary)", "#8b5cf6", "var(--brand-primary)"]}
            animationSpeed={6}
          >
            {teacherName}
          </GradientText>
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", menuOpen && "rotate-180")}
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
                    <p className="truncate text-sm font-semibold">{teacherName}</p>
                    <p className="truncate text-xs text-muted-foreground">Teacher</p>
                  </div>
                  <div className="p-1">
                    <Link
                      href={`${base}/profile`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                      role="menuitem"
                    >
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      Profile
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
