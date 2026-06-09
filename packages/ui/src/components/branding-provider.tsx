"use client";
import * as React from "react";
import { createContext, useContext, useEffect, useMemo } from "react";

/**
 * Public branding shape (mirrors BrandingPublic in CONTRACTS.md).
 * WHITE-LABEL: this is the ONLY identity ever rendered on institution panels.
 */
export interface BrandingPublic {
  slug: string;
  schoolName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

const BrandingContext = createContext<BrandingPublic | null>(null);

/** Read the active institution branding (null on the operator panel / before load). */
export function useBranding(): BrandingPublic | null {
  return useContext(BrandingContext);
}

export interface BrandingProviderProps {
  /** null ⇒ default Steel Blue (operator panel / branding not yet loaded). */
  branding: BrandingPublic | null;
  children: React.ReactNode;
}

/**
 * Injects the institution's primary color into the brand CSS custom properties
 * (per the "INSTITUTION PANEL BRANDING OVERRIDE" spec) so every component that
 * reads --brand-primary / --brand-accent / the glow vars adopts it automatically.
 * Also sets document.title to the institution's schoolName.
 */
export function BrandingProvider({ branding, children }: BrandingProviderProps) {
  const primary = branding?.primaryColor ?? "#5B8DEF";

  useEffect(() => {
    if (branding?.schoolName) document.title = branding.schoolName;
  }, [branding?.schoolName]);

  const vars = useMemo(
    () =>
      ({
        "--brand-primary": primary,
        "--brand-primary-light": primary + "dd",
        "--brand-primary-dark": primary + "aa",
        "--brand-primary-deep": primary + "aa",
        "--brand-primary-hover": primary,
        "--brand-primary-light-hover": primary + "dd",
        "--brand-accent": primary,
        "--brand-accent-light": primary + "dd",
        "--glow-primary-sm": `0 0 20px ${primary}4d`,
        "--glow-primary-lg": `0 0 40px ${primary}80, 0 0 80px ${primary}26`,
        "--shadow-brand-glow": `0 0 6px ${primary}80`,
      }) as React.CSSProperties,
    [primary]
  );

  return (
    <BrandingContext.Provider value={branding}>
      {/* display:contents — custom properties still inherit to all children */}
      <div style={vars} className="contents">
        {children}
      </div>
    </BrandingContext.Provider>
  );
}
