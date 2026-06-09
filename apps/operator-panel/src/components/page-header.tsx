"use client";
// Standard page header per the design spec: GradientText title + ShinyText
// subtitle + actions slot, wrapped in BlurFade, with the ambient brand glow.

import { BlurFade, GradientText, ShinyText } from "@maxmusic/ui";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      {/* Ambient background glow — steel blue, very subtle */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <GradientText className="text-2xl font-bold">{title}</GradientText>
            <ShinyText text={subtitle} speed={6} className="mt-1 text-sm" />
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </BlurFade>
    </>
  );
}
