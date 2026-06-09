"use client";
import { useEffect, useMemo, useState } from "react";
import { Link2, Loader2, Plus, Radio, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, Button, CountUp, Input, Modal, Select,
  StatsCard, StatusBadge, cn,
} from "@maxmusic/ui";
import { Table, type DataTableColumn } from "@/components/table";
import { formatCurrency, formatDate, formatPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_PAYMENTS, MOCK_STUDENTS, MOCK_WEBHOOK_EVENTS, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, Paginated, PaymentRow, WebhookEventRow,
} from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { StatsRowSkeleton, TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";
import { timeAgo } from "@/components/activity-feed";

type SubTab = "history" | "reconciliation";

interface PaymentForm {
  studentId: string | null;
  type: "fee" | "admission";
  amountRupees: string;
  classesPurchased: string;
  period: string;
  method: string | null;
  status: PaymentRow["status"];
}

const EMPTY_FORM: PaymentForm = {
  studentId: null, type: "fee", amountRupees: "", classesPurchased: "",
  period: "", method: "manual", status: "paid",
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<SubTab>("history");
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [events, setEvents] = useState<WebhookEventRow[] | null>(null);

  const [entering, setEntering] = useState(false);
  const [form, setForm] = useState<PaymentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [matching, setMatching] = useState<WebhookEventRow | null>(null);
  const [matchPaymentId, setMatchPaymentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<Paginated<PaymentRow>>>(adminPath("/payments?page=1&limit=100")),
      ok(paginate(MOCK_PAYMENTS))
    ).then((r) => !cancelled && setPayments(r.data?.items ?? []));
    mockable(
      () =>
        api.get<ApiResponse<Paginated<WebhookEventRow>>>(
          adminPath("/payments/reconciliation?page=1&limit=100")
        ),
      ok(paginate(MOCK_WEBHOOK_EVENTS))
    ).then((r) => !cancelled && setEvents(r.data?.items ?? []));
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    if (!payments) return null;
    const now = new Date();
    const collected = payments
      .filter((p) => {
        if (!p.paidAt) return false;
        const d = new Date(p.paidAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s, p) => s + p.amount, 0);
    const overdue = payments.filter((p) => p.status === "overdue");
    const unmatched = (events ?? []).filter((e) => e.paymentId === null).length;
    return {
      collectedRupees: Math.round(collected / 100),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, p) => s + p.amount, 0),
      unmatched,
    };
  }, [payments, events]);

  const addPayment = async () => {
    if (!form.studentId) return toast.error("Select a student");
    const amountPaise = Math.round(Number(form.amountRupees) * 100);
    if (!form.amountRupees || Number.isNaN(amountPaise) || amountPaise < 0) {
      return toast.error("Enter a valid amount in rupees");
    }
    setSaving(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse>(adminPath("/payments"), {
            studentId: form.studentId,
            type: form.type,
            amount: amountPaise,
            period: form.period || undefined,
            method: form.method ?? undefined,
            status: form.status,
            paidAt: form.status === "paid" ? new Date().toISOString() : undefined,
          }),
        ok(null),
        500
      );
      const student = MOCK_STUDENTS.find((s) => s._id === form.studentId)!;
      setPayments((prev) => [
        {
          _id: `pay_local_${Date.now()}`,
          student: { _id: student._id, name: student.name },
          type: form.type,
          period: form.period || null,
          amount: amountPaise,
          status: form.status,
          method: form.method ?? "manual",
          paidAt: form.status === "paid" ? new Date().toISOString() : null,
        },
        ...(prev ?? []),
      ]);
      toast.success(
        `${formatCurrency(amountPaise)} recorded for ${student.name}` +
          (form.classesPurchased ? ` · ${form.classesPurchased} classes` : "")
      );
      setEntering(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const matchEvent = async () => {
    if (!matching || !matchPaymentId) {
      toast.error("Select the payment record to link");
      return;
    }
    // NOTE: CONTRACTS.md defines /payments/reconciliation as a READ-ONLY feed —
    // there is no match endpoint yet. This action is local-only until Dev A
    // adds one (flagged to the orchestrator).
    await new Promise((r) => setTimeout(r, 400));
    setEvents((prev) =>
      (prev ?? []).map((e) =>
        e._id === matching._id ? { ...e, paymentId: matchPaymentId } : e
      )
    );
    toast.success("Webhook event matched to payment record");
  };

  const columns: DataTableColumn<PaymentRow>[] = [
    { key: "student", label: "Student", render: (p) => <span className="font-medium">{p.student.name}</span> },
    { key: "type", label: "Type", render: (p) => <span className="capitalize">{p.type}</span> },
    { key: "period", label: "Period", render: (p) => p.period ?? <span className="text-xs text-muted-foreground">—</span> },
    { key: "amount", label: "Amount", render: (p) => <span className="font-semibold">{formatCurrency(p.amount)}</span> },
    { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
    { key: "method", label: "Method", render: (p) => <span className="text-xs capitalize">{p.method}</span> },
    { key: "paidAt", label: "Paid At", render: (p) => <span className="text-xs">{formatDate(p.paidAt)}</span> },
  ];

  return (
    <PageShell
      title="Payments"
      subtitle="Fee history and Razorpay reconciliation"
      actions={
        <Button variant="brand" className="group rounded-full" onClick={() => setEntering(true)}>
          Manual Fee Entry
          <Plus className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </Button>
      }
    >
      {/* Summary stats */}
      {!summary ? (
        <StatsRowSkeleton count={3} />
      ) : (
        <BlurFade delay={0.1}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              label="Collected This Month"
              value={
                <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                  <span className="text-[0.65em] font-semibold text-muted-foreground">₹</span>
                  <CountUp to={summary.collectedRupees} separator="," />
                </span>
              }
              icon={Wallet}
              trend="all methods"
            />
            <StatsCard
              label="Overdue"
              value={summary.overdueCount}
              icon={Radio}
              trend={`${formatCurrency(summary.overdueAmount)} outstanding`}
            />
            <StatsCard
              label="Unmatched Webhooks"
              value={summary.unmatched}
              icon={Link2}
              trend="need manual reconciliation"
            />
          </div>
        </BlurFade>
      )}

      {/* Sub-tabs */}
      <BlurFade delay={0.15}>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1 sm:w-fit">
          {(
            [
              ["history", "Payment History"],
              ["reconciliation", "Reconciliation"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-all",
                tab === key
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {tab === "history" ? (
          !payments ? (
            <TableSkeleton />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments yet"
              hint="Record your first fee with Manual Fee Entry — Razorpay payments appear here automatically."
            />
          ) : (
            <Table columns={columns} data={payments} />
          )
        ) : !events ? (
          <TableSkeleton />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No webhook events"
            hint="Razorpay webhook events arrive here as students pay through payment links."
          />
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={80} duration={10} />
            <ul className="divide-y divide-border/50">
              {events.map((e) => {
                const matched = e.paymentId !== null;
                return (
                  <li key={e._id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        matched ? "bg-emerald-400/12" : "bg-amber-400/12"
                      )}
                    >
                      <Radio
                        className={cn("h-4 w-4", matched ? "text-emerald-500" : "text-amber-500")}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <span className="font-mono text-xs text-brand">{e.eventType}</span>
                        {" · "}
                        {e.payerName ?? "Unknown payer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.contact ? formatPhone(e.contact) : "No contact"} ·{" "}
                        {e.amount !== null ? formatCurrency(e.amount) : "Amount n/a"} ·{" "}
                        {timeAgo(e.receivedAt)}
                      </p>
                    </div>
                    <StatusBadge status={matched ? "matched" : "unmatched"} />
                    {!matched && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          setMatching(e);
                          setMatchPaymentId(null);
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Match
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </BlurFade>

      {/* Manual fee entry */}
      <Modal
        open={entering}
        onClose={() => setEntering(false)}
        title="Manual Fee Entry"
        subtitle="Record a cash / bank / offline payment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEntering(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={addPayment} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Student"
            required
            searchable
            placeholder="Select student"
            options={MOCK_STUDENTS.map((s) => ({
              value: s._id,
              label: `${s.name} (${s.displayId})`,
            }))}
            value={form.studentId}
            onChange={(v) => setForm({ ...form, studentId: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              options={[
                { value: "fee", label: "Fee" },
                { value: "admission", label: "Admission" },
              ]}
              value={form.type}
              onChange={(v) => setForm({ ...form, type: (v as "fee" | "admission") ?? "fee" })}
            />
            <Input
              label="Amount (₹)"
              required
              type="number"
              min={0}
              placeholder="e.g. 6000"
              value={form.amountRupees}
              onChange={(e) => setForm({ ...form, amountRupees: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Classes purchased"
              type="number"
              min={0}
              placeholder="e.g. 24"
              value={form.classesPurchased}
              onChange={(e) => setForm({ ...form, classesPurchased: e.target.value })}
            />
            <Input
              label="Period"
              placeholder="e.g. Jun 2026"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Method"
              options={[
                { value: "manual", label: "Manual / Bank" },
                { value: "cash", label: "Cash" },
                { value: "razorpay", label: "Razorpay link" },
              ]}
              value={form.method}
              onChange={(v) => setForm({ ...form, method: v })}
            />
            <Select
              label="Status"
              options={[
                { value: "paid", label: "Paid" },
                { value: "partial", label: "Partial" },
                { value: "overdue", label: "Overdue" },
                { value: "free", label: "Free" },
              ]}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: (v as PaymentRow["status"]) ?? "paid" })}
            />
          </div>
          {form.amountRupees && (
            <p className="text-xs text-muted-foreground">
              Stored as {formatCurrency(Math.round(Number(form.amountRupees) * 100) || 0)}
              {form.classesPurchased && ` · updates paid classes to ${form.classesPurchased}`}.
            </p>
          )}
        </div>
      </Modal>

      {/* Match webhook → payment */}
      <ConfirmModal
        open={!!matching}
        onClose={() => setMatching(null)}
        title="Match webhook event"
        message={
          matching
            ? `Link "${matching.eventType}" from ${matching.payerName ?? "unknown payer"} (${
                matching.amount !== null ? formatCurrency(matching.amount) : "amount n/a"
              }) to a payment record.`
            : undefined
        }
        confirmLabel="Match Event"
        onConfirm={matchEvent}
      >
        <Select
          label="Payment record"
          required
          searchable
          placeholder="Select payment"
          options={(payments ?? []).map((p) => ({
            value: p._id,
            label: `${p.student.name} · ${formatCurrency(p.amount)} · ${p.period ?? p.type}`,
          }))}
          value={matchPaymentId}
          onChange={setMatchPaymentId}
        />
      </ConfirmModal>
    </PageShell>
  );
}
