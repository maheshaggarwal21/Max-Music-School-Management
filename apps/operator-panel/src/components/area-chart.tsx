"use client";
// Local workaround: packages/ui charts.tsx only exports Line + Bar charts.
// The dashboard spec calls for an AREA chart of fee collections, so this lives
// here until an Area variant is upstreamed. Colors read CSS vars only.

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart as ReAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = "var(--brand-primary)";

// ResponsiveContainer measures -1×-1 if rendered before the parent has layout
// (logs a recharts warning). Mount the chart one tick after first paint.
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function AreaChart({
  data,
  xKey,
  yKey,
  height = 280,
  className,
  valueFormatter = (v) => String(v),
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  const mounted = useMounted();
  return (
    <div className={className} style={{ width: "100%", height }}>
      {mounted && (
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ReAreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="opFeeArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(v: number) => valueFormatter(v)}
          />
          <Tooltip
            formatter={(value) => [valueFormatter(Number(value)), "Collected"]}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#opFeeArea)"
            dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ReAreaChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
