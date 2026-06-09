"use client";
import * as React from "react";
import { useTheme } from "next-themes";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Theme toggle with a circular reveal radiating from the clicked control
 * (View Transitions API). Falls back to an instant switch on browsers
 * without startViewTransition or when reduced motion is requested.
 *
 * The matching ::view-transition-* CSS lives in styles/globals.css.
 */
export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = React.useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      const root = document.documentElement;
      // next-themes applies the class in an effect (async) — toggle it
      // synchronously too so the view-transition snapshot is the NEW theme.
      const apply = () => {
        root.classList.toggle("dark", next === "dark");
        root.style.colorScheme = next;
        setTheme(next);
      };

      const doc = document as DocumentWithViewTransition;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!doc.startViewTransition || reduceMotion) {
        apply();
        return;
      }

      // Reveal origin = center of the sun/moon control that was clicked.
      const rect = (event?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 24;
      const y = rect ? rect.top + rect.height / 2 : 24;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(apply);
      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${Math.ceil(radius)}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 600,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {
          /* theme already applied; animation is best-effort */
        });
    },
    [resolvedTheme, setTheme]
  );

  return { resolvedTheme, toggleTheme };
}
