"use client";
// P5-07 — Payments: tab switcher (Student Fees | Rent Invoices), fee table
// with status + reconciliation source, rent table with optimistic mark-paid.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, IndianRupee, ReceiptText, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  Button,
  Input,
  Select,
  StatusBadge,
} from "@maxmusic/ui";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatCurrency, formatDate } from "@maxmusic/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/skeleton";
import { Tabs } from "@/components/tabs";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import {
  mockMarkRentPaid,
  mockPaymentList,
  mockRentInvoiceList,
} from "@/lib/mocks";
import { useInstitutionOptions } from "@/lib/use-institution-options";
import type { ApiResponse, OperatorPaymentRow, Paginated, RentInvoiceItem } from "@/lib/types";

const LIMIT = 10;

const FEE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "free", label: "Free" },
];

const METHOD_TONE: Record<OperatorPaymentRow["method"], "brand" | "neutral" | "amber"> = {
  razorpay: "brand",
  manual: "neutral",
  cash: "amber",
};

export default function PaymentsPage() {
  const [tab, setTab] = useState("fees");

  // ── Student fees state ──
  const [fees, setFees] = useState<OperatorPaymentRow[]>([]);
  const [feePagination, setFeePagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeInitial, setFeeInitial] = useState(true);
  const [feePage, setFeePage] = useState(1);
  const [feeInstitutionId, setFeeInstitutionId] = useState<string | null>(null);
  const [feeStatus, setFeeStatus] = useState<string | null>("all");
  const institutionOptions = useInstitutionOptions();

  // ── Rent invoices state ──
  const [rents, setRents] = useState<RentInvoiceItem[]>([]);
  const [rentPagination, setRentPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [rentLoading, setRentLoading] = useState(true);
  const [rentInitial, setRentInitial] = useState(true);
  const [rentPage, setRentPage] = useState(1);
  const [markTarget, setMarkTarget] = useState<RentInvoiceItem | null>(null);
  const [reference, setReference] = useState("");

  const fetchFees = useCallback(async () => {
    setFeeLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(feePage),
        limit: String(LIMIT),
        institutionId: feeInstitutionId ?? "",
        status: feeStatus ?? "all",
      });
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<OperatorPaymentRow>>>(`/api/operator/payments?${params}`),
        mockPaymentList({
          page: feePage,
          limit: LIMIT,
          institutionId: feeInstitutionId ?? undefined,
          status: feeStatus ?? "all",
        })
      );
      if (res.data) {
        setFees(res.data.items);
        setFeePagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setFeeLoading(false);
      setFeeInitial(false);
    }
  }, [feePage, feeInstitutionId, feeStatus]);

  const fetchRents = useCallback(async () => {
    setRentLoading(true);
    try {
      const params = new URLSearchParams({ page: String(rentPage), limit: String(LIMIT) });
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<RentInvoiceItem>>>(
            `/api/operator/rent-invoices?${params}`
          ),
        mockRentInvoiceList({ page: rentPage, limit: LIMIT })
      );
      if (res.data) {
        setRents(res.data.items);
        setRentPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load rent invoices");
    } finally {
      setRentLoading(false);
      setRentInitial(false);
    }
  }, [rentPage]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  useEffect(() => {
    fetchRents();
  }, [fetchRents]);

  // Optimistic mark-paid with rollback on failure
  const markPaid = async () => {
    if (!markTarget) return;
    const target = markTarget;
    const ref = reference.trim() || null;
    const previous = rents;
    setRents((prev) =>
      prev.map((r) =>
        r._id === target._id
          ? { ...r, status: "paid" as const, paidAt: new Date().toISOString(), reference: ref }
          : r
      )
    );
    try {
      await mockable(
        () =>
          api.post<ApiResponse<RentInvoiceItem>>(
            `/api/operator/rent-invoices/${target._id}/mark-paid`,
            { reference: ref }
          ),
        mockMarkRentPaid(target, ref)
      );
      toast.success(`Rent for ${target.institution.name} · ${target.period} marked paid`);
      setReference("");
    } catch (err) {
      setRents(previous); // rollback
      toast.error(err instanceof Error ? err.message : "Failed to mark paid");
      throw err;
    }
  };

  const feeColumns: DataTableColumn<OperatorPaymentRow>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => <span className="font-medium">{r.student.name}</span>,
    },
    {
      key: "institution",
      label: "Institution",
      render: (r) => <Tag>{r.institution.name}</Tag>,
    },
    {
      key: "type",
      label: "Type",
      render: (r) => <span className="capitalize text-muted-foreground">{r.type}</span>,
    },
    {
      key: "period",
      label: "Period",
      render: (r) => <span className="text-muted-foreground">{r.period ?? "—"}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => <span className="tabular-nums font-medium">{formatCurrency(r.amount)}</span>,
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "method",
      label: "Source",
      render: (r) => <Tag tone={METHOD_TONE[r.method]}>{r.method}</Tag>,
    },
    {
      key: "paidAt",
      label: "Paid at",
      render: (r) => (
        <span className="text-muted-foreground">{r.paidAt ? formatDate(r.paidAt) : "—"}</span>
      ),
    },
  ];

  const rentColumns: DataTableColumn<RentInvoiceItem>[] = [
    {
      key: "institution",
      label: "Institution",
      render: (r) => <Tag>{r.institution.name}</Tag>,
    },
    { key: "period", label: "Period", render: (r) => <span className="font-medium">{r.period}</span> },
    {
      key: "amount",
      label: "Amount",
      render: (r) => <span className="tabular-nums font-medium">{formatCurrency(r.amount)}</span>,
    },
    {
      key: "dueDate",
      label: "Due",
      render: (r) => <span className="text-muted-foreground">{formatDate(r.dueDate)}</span>,
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "reference",
      label: "Reference",
      render: (r) =>
        r.reference ? (
          <Tag tone="neutral" className="font-mono">{r.reference}</Tag>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "action",
      label: "",
      render: (r) =>
        r.status !== "paid" ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setMarkTarget(r)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
            Mark paid
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Payments"
        subtitle="Student fees across institutions · rent invoices owed to the platform"
      />

      <BlurFade delay={0.1}>
        <Tabs
          tabs={[
            { key: "fees", label: "Student Fees", icon: IndianRupee },
            { key: "rents", label: "Rent Invoices", icon: ReceiptText },
          ]}
          active={tab}
          onChange={setTab}
        />
      </BlurFade>

      {tab === "fees" && (
        <>
          <BlurFade delay={0.15}>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                options={[{ value: "", label: "All institutions" }, ...institutionOptions]}
                value={feeInstitutionId ?? ""}
                onChange={(v) => {
                  setFeeInstitutionId(v || null);
                  setFeePage(1);
                }}
                searchable
                className="w-64"
              />
              <Select
                options={FEE_STATUS_OPTIONS}
                value={feeStatus}
                onChange={(v) => {
                  setFeeStatus(v);
                  setFeePage(1);
                }}
                className="w-44"
              />
            </div>
          </BlurFade>

          <BlurFade delay={0.2}>
            {feeInitial ? (
              <TableSkeleton rows={8} cols={8} />
            ) : !feeLoading && fees.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No fee records"
                description="No student fee entries match the current filters. Fees are entered manually by institution admins; Razorpay webhooks feed the reconciliation source."
              />
            ) : (
              <DataTable
                columns={feeColumns}
                data={fees}
                loading={feeLoading}
                pagination={{ ...feePagination, onPageChange: setFeePage }}
              />
            )}
          </BlurFade>
        </>
      )}

      {tab === "rents" && (
        <BlurFade delay={0.15}>
          {rentInitial ? (
            <TableSkeleton rows={6} cols={7} />
          ) : !rentLoading && rents.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No rent invoices"
              description="Rent invoices are raised monthly for autonomous institutions. None exist yet."
            />
          ) : (
            <DataTable
              columns={rentColumns}
              data={rents}
              loading={rentLoading}
              pagination={{ ...rentPagination, onPageChange: setRentPage }}
            />
          )}
        </BlurFade>
      )}

      {/* Mark-paid confirm (optimistic) */}
      <ConfirmModal
        open={!!markTarget}
        onClose={() => {
          setMarkTarget(null);
          setReference("");
        }}
        title="Mark rent as paid"
        description={
          markTarget ? (
            <>
              <span className="font-medium text-foreground">{markTarget.institution.name}</span> ·{" "}
              {markTarget.period} · {formatCurrency(markTarget.amount)}. The table updates
              immediately; the action is audited as MARK_RENT_PAID.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Mark paid"
        onConfirm={markPaid}
      >
        <Input
          label="Payment reference (optional)"
          placeholder="e.g. NEFT-88412 / UPI ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </ConfirmModal>
    </div>
  );
}
