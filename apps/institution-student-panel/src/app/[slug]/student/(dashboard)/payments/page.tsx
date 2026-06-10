"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { BadgeCheck, CalendarHeart, ReceiptIndianRupee, Wallet } from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  CountUp,
  DataTable,
  GradientText,
  ShinyText,
  SpotlightCard,
  StatusBadge,
  type DataTableColumn,
} from "@maxmusic/ui";
import { formatCurrency, formatDate } from "@maxmusic/utils";

import { mockable } from "@/lib/api";
import {
  MOCK_CLASS_BALANCE,
  MOCK_PAYMENTS,
  type ClassBalance,
  type StudentPaymentItem,
} from "@/lib/mocks";
import { useStudent } from "@/components/student-provider";
import { EmptyState } from "@/components/empty-state";

// PENDING CONTRACT — CONTRACTS.md has no student payments endpoint yet
// (requested from Dev A). Until then this page is mock-only: the real-call
// branch resolves an empty list so nothing uncontracted is ever wired.

type PaymentTableRow = StudentPaymentItem & Record<string, unknown>;

const columns: DataTableColumn<PaymentTableRow>[] = [
  {
    key: "paidAt",
    label: "Date",
    render: (row) => <span className="whitespace-nowrap">{formatDate(row.paidAt)}</span>,
  },
  {
    key: "type",
    label: "Type",
    render: (row) => (
      <span className="capitalize">
        {row.type}
        {row.period && (
          <span className="ml-1.5 text-xs text-muted-foreground">({row.period})</span>
        )}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    render: (row) => (
      <span className="whitespace-nowrap font-semibold">{formatCurrency(row.amount)}</span>
    ),
  },
  {
    key: "classesPurchased",
    label: "Classes",
    render: (row) => (row.classesPurchased > 0 ? `${row.classesPurchased} classes` : "—"),
  },
  {
    key: "method",
    label: "Method",
    render: (row) => <span className="capitalize">{row.method}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function PaymentsPage() {
  const { student } = useStudent();
  const [payments, setPayments] = useState<StudentPaymentItem[]>([]);
  const [balance, setBalance] = useState<ClassBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockable<StudentPaymentItem[]>(() => Promise.resolve([]), MOCK_PAYMENTS),
      mockable<ClassBalance | null>(() => Promise.resolve(null), MOCK_CLASS_BALANCE),
    ])
      .then(([p, b]) => {
        if (cancelled) return;
        setPayments(p);
        setBalance(b);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const validityEnd = balance?.validityEnd ?? student?.validityEnd ?? null;

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="text-2xl font-bold">Payments</GradientText>
          <ShinyText
            text="Your fee receipts and class validity"
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      {/* Validity card */}
      <BlurFade delay={0.1}>
        <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
          <BorderBeam size={50} duration={9} />
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="rounded-2xl bg-brand/10 p-4"
                style={{ boxShadow: "var(--glow-primary-sm)" }}
              >
                <CalendarHeart className="h-6 w-6 text-brand" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Classes paid until
                </p>
                <GradientText className="mt-1 text-xl font-bold">
                  {validityEnd ? formatDate(validityEnd) : "—"}
                </GradientText>
                {validityEnd && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Renew before {formatDate(validityEnd)} to keep your weekly slot.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-8">
              {balance && (
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Classes left
                  </p>
                  <p className="mt-1 text-3xl font-bold">
                    <CountUp to={balance.paidClasses - balance.classesUsed} />
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total paid
                </p>
                <p className="mt-1 whitespace-nowrap text-3xl font-bold">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </BlurFade>

      {/* Payment history */}
      <BlurFade delay={0.2}>
        {!loading && payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            message="Your fee receipts appear here once your school records a payment."
          />
        ) : (
          <div>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
              <ReceiptIndianRupee className="h-4 w-4 text-brand" />
              Payment history
            </h2>
            <DataTable<PaymentTableRow>
              columns={columns}
              data={payments as PaymentTableRow[]}
              loading={loading}
              emptyMessage="No payments yet — your fee receipts appear here."
            />
          </div>
        )}
      </BlurFade>
    </div>
  );
}
