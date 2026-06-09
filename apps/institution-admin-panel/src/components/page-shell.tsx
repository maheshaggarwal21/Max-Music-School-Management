"use client";
import { BlurFade, GradientText, ShinyText } from "@maxmusic/ui";

/**
 * Standard dashboard page frame: ambient brand glow (reads --brand-primary so
 * it follows the institution's branding), animated header, action slot.
 */
export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-6 p-6">
      {/* Ambient background glow — institution brand color, very subtle */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <GradientText className="text-2xl font-bold">{title}</GradientText>
            {subtitle && (
              <div className="mt-1">
                <ShinyText text={subtitle} speed={6} className="text-sm" />
              </div>
            )}
          </div>
          {actions}
        </div>
      </BlurFade>

      {children}
    </div>
  );
}
