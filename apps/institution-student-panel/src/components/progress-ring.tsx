"use client";
import { CountUp } from "@maxmusic/ui";

export interface ProgressRingProps {
  /** 0..max */
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Big number rendered in the center (defaults to `value`). */
  centerValue?: number;
  centerSuffix?: string;
  label?: string;
  className?: string;
}

/**
 * Brand-colored SVG progress ring with a CountUp center.
 * Color comes from --brand-primary so it follows institution branding.
 */
export function ProgressRing({
  value,
  max,
  size = 148,
  stroke = 11,
  centerValue,
  centerSuffix,
  label,
  className,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;

  return (
    <div className={`relative inline-flex items-center justify-center ${className ?? ""}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          stroke="var(--brand-primary)"
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter:
              "drop-shadow(0 0 6px color-mix(in srgb, var(--brand-primary) 45%, transparent))",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold leading-none">
          <CountUp to={centerValue ?? value} />
          {centerSuffix && <span className="text-lg font-semibold">{centerSuffix}</span>}
        </span>
        {label && (
          <span className="mt-1 max-w-[80%] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
