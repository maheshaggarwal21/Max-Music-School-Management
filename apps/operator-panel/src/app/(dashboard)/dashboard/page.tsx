"use client";
// P5-03 — Operator dashboard: stats row (CountUp), fee-collection area chart,
// recent activity feed. All data via mockable() → GET /api/operator/dashboard.

import { useEffect, useState } from "react";
import {
  Building2,
  GraduationCap,
  IndianRupee,
  KeyRound,
  Plus,
  ReceiptText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, BlurFade, BorderBeam, StatsCard } from "@maxmusic/ui";
import { formatCurrency, formatDate } from "@maxmusic/utils";
import { AreaChart } from "@/components/area-chart";
import { CurrencyCountUp } from "@/components/currency-count-up";
import { PageHeader } from "@/components/page-header";
import { QuickActions } from "@/components/quick-actions";
import { StatsRowSkeleton, Skeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { mockDashboard } from "@/lib/mocks";
import type { ApiResponse, AuditLogItem, OperatorDashboardData } from "@/lib/types";

function activityLine(item: AuditLogItem): string {
  if (item.changes?.length) {
    const c = item.changes[0];
    return `${c.field.toUpperCase()} changed from ${JSON.stringify(c.from)} to ${JSON.stringify(c.to)}`;
  }
  return item.entityLabel ?? item.entityType;
}

export default function DashboardPage() {
  const [data, setData] = useState<OperatorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const feeTrend = data?.revenue.feeTrend ?? [];

  useEffect(() => {
    let alive = true;
    mockable(
      () => api.get<ApiResponse<OperatorDashboardData>>("/api/operator/dashboard"),
      mockDashboard()
    )
      .then((res) => {
        if (alive && res.data) setData(res.data);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Dashboard"
        subtitle={
          data
            ? `${data.institutions.total} institutions · ${data.totals.students} students across the platform`
            : "Loading platform overview…"
        }
      />

      {/* Quick actions — core operations up front (A1) */}
      <QuickActions
        actions={[
          { label: "Add Institution", hint: "Onboard a new school", href: "/institutions?new=1", icon: Plus },
          { label: "Institutions", hint: "Manage & impersonate", href: "/institutions", icon: Building2 },
          { label: "Students", hint: "All students, god view", href: "/students", icon: GraduationCap },
          { label: "Teachers", hint: "All teachers, god view", href: "/teachers", icon: Users },
          { label: "Credentials", hint: "Reset forgotten passwords", href: "/credentials", icon: KeyRound },
          { label: "Settings", hint: "Platform defaults & OTP", href: "/settings", icon: Settings },
        ]}
      />

      {/* Stats row */}
      <BlurFade delay={0.1}>
        {loading || !data ? (
          <StatsRowSkeleton count={5} />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatsCard
              label="Institutions"
              value={data.institutions.total}
              icon={Building2}
              trend={`${data.institutions.active} active · ${data.institutions.suspended} suspended`}
            />
            <StatsCard
              label="Active Students"
              value={data.totals.students}
              icon={GraduationCap}
              trend="across all institutions"
            />
            <StatsCard
              label="Teachers"
              value={data.totals.teachers}
              icon={Users}
              trend="platform-wide"
            />
            <StatsCard
              label="Fee Collection"
              value={
                <CurrencyCountUp
                  to={data.revenue.feeCollectedThisMonth}
                  className="text-2xl xl:text-3xl"
                />
              }
              icon={IndianRupee}
              trend="this month"
            />
            <StatsCard
              label="Pending Rent"
              value={
                <CurrencyCountUp to={data.revenue.rentOverdue} className="text-2xl xl:text-3xl" />
              }
              icon={ReceiptText}
              trend={`${data.overdueRents.length} invoices overdue`}
            />
          </div>
        )}
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Fee collection trend */}
        <BlurFade delay={0.2} className="lg:col-span-2">
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={60} duration={8} />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Fee collections</h2>
                <p className="text-xs text-muted-foreground">Last 6 months · all institutions</p>
              </div>
              {feeTrend.length > 0 && (
                <Tag>
                  {feeTrend[0].month} – {feeTrend[feeTrend.length - 1].month}{" "}
                  {new Date().getFullYear()}
                </Tag>
              )}
            </div>
            {loading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <AreaChart
                data={feeTrend}
                xKey="month"
                yKey="collected"
                valueFormatter={(v) => formatCurrency(v)}
              />
            )}
          </div>
        </BlurFade>

        {/* Recent activity feed */}
        <BlurFade delay={0.3}>
          <div className="relative h-full overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={60} duration={10} />
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold">Recent activity</h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(data?.recentChanges ?? []).map((item, i) => (
                  <BlurFade key={item._id} delay={0.35 + i * 0.08}>
                    <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
                      <Avatar name={item.actorName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium">{item.actorName}</span>{" "}
                          <span className="text-muted-foreground">
                            · {item.action.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {activityLine(item)}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {item.institution && (
                            <Tag className="max-w-[130px]">{item.institution.name}</Tag>
                          )}
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </BlurFade>
                ))}
              </div>
            )}
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
