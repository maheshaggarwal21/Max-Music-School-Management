"use client";
import * as React from "react";
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// All series colors read from the brand CSS var so institution panels
// automatically re-color charts via BrandingProvider.
const BRAND = "var(--brand-primary)";

// ResponsiveContainer measures -1×-1 if rendered before the parent has layout
// (logs a recharts warning). Mount charts one tick after first paint.
function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

export interface ChartProps {
  data: Record<string, unknown>[];
  /** key on each datum used for the X axis */
  xKey: string;
  /** key on each datum used for the Y values */
  yKey: string;
  height?: number;
  className?: string;
}

export function LineChart({ data, xKey, yKey, height = 260, className }: ChartProps) {
  const mounted = useMounted();
  return (
    <div className={className} style={{ width: "100%", height }}>
      {mounted && (
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ReLineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={BRAND}
            strokeWidth={2}
            dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ReLineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}

export function BarChart({ data, xKey, yKey, height = 260, className }: ChartProps) {
  const mounted = useMounted();
  return (
    <div className={className} style={{ width: "100%", height }}>
      {mounted && (
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ReBarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            width={36}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
          />
          <Bar dataKey={yKey} fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </ReBarChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
