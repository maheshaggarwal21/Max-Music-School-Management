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
