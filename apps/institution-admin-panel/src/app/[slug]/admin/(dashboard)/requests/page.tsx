"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Inbox, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, Button, Input, Modal, Select, StatusBadge, cn,
} from "@maxmusic/ui";
import { Table, type DataTableColumn } from "@/components/table";
import { formatDate, formatPhone, isValidPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_DAY_PATTERNS, MOCK_INSTRUMENTS, MOCK_REQUESTS, MOCK_TEACHERS,
  MOCK_TIME_SLOTS, ok, paginate,
} from "@/lib/mocks";
import type { ApiResponse, Paginated, RequestItem } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { ConfirmModal } from "@/components/confirm-modal";
import { ApproveRequestModal } from "@/components/approve-request-modal";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";

const FILTERS = ["pending", "approved", "rejected", "all"] as const;
type Filter = (typeof FILTERS)[number];

const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  instrumentId: null as string | null,
  preferredDayPatternId: null as string | null,
  preferredTimeSlotId: null as string | null,
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<RequestItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  // approve / reject targets
  const [approving, setApproving] = useState<RequestItem | null>(null);
  const [rejecting, setRejecting] = useState<RequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // new request modal
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ?new=1 deep-link from the dashboard quick-action card (A1)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("new")) setCreating(true);
  }, []);

  // reference lists for the form dropdowns — fetched live from this institution
  const [instruments, setInstruments] = useState<{ _id: string; name: string }[]>([]);
  const [dayPatterns, setDayPatterns] = useState<{ _id: string; label: string; isActive: boolean }[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ _id: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<Paginated<RequestItem>>>(adminPath("/requests?status=all")),
      ok(paginate(MOCK_REQUESTS))
    ).then((r) => !cancelled && setRequests(r.data?.items ?? []));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockable(
        () => api.get<ApiResponse<{ instruments: { _id: string; name: string }[] }>>(adminPath("/instruments")),
        ok({ instruments: MOCK_INSTRUMENTS })
      ),
      mockable(
        () => api.get<ApiResponse<{ dayPatterns: { _id: string; label: string; isActive: boolean }[] }>>(adminPath("/day-patterns")),
        ok({ dayPatterns: MOCK_DAY_PATTERNS })
      ),
      mockable(
        () => api.get<ApiResponse<{ timeSlots: { _id: string; label: string }[] }>>(adminPath("/time-slots")),
        ok({ timeSlots: MOCK_TIME_SLOTS })
      ),
    ]).then(([i, d, t]) => {
      if (cancelled) return;
      setInstruments(i.data?.instruments ?? []);
      setDayPatterns(d.data?.dayPatterns ?? []);
      setTimeSlots(t.data?.timeSlots ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      (requests ?? []).filter((r) => filter === "all" || r.status === filter),
    [requests, filter]
  );

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, all: requests?.length ?? 0 };
    for (const r of requests ?? []) c[r.status] += 1;
    return c;
  }, [requests]);

  const reject = async () => {
    if (!rejecting) return;
    await mockable(
      () =>
        api.post<ApiResponse>(adminPath(`/requests/${rejecting._id}/reject`), {
          reason: rejectReason || undefined,
        }),
      ok(null),
      500
    );
    setRequests((prev) =>
      (prev ?? []).map((r) => (r._id === rejecting._id ? { ...r, status: "rejected" } : r))
    );
    toast.success(`Request from ${rejecting.name} rejected`);
  };

  const createRequest = async () => {
    if (!form.name.trim()) {
      toast.error("Student name is required");
      return;
    }
    if (!isValidPhone(form.mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSaving(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ request: RequestItem } | null>>(adminPath("/requests"), {
            name: form.name.trim(),
            mobile: form.mobile,
            email: form.email || undefined,
            instrumentId: form.instrumentId ?? undefined,
            preferredDayPatternId: form.preferredDayPatternId ?? undefined,
            preferredTimeSlotId: form.preferredTimeSlotId ?? undefined,
          }),
        ok(null),
        500
      );
      // Live mode returns the persisted request — its real _id is what approve/reject
      // post back, so a locally fabricated row is only acceptable as the mock fallback.
      const instrument = instruments.find((i) => i._id === form.instrumentId) ?? null;
      const dp = dayPatterns.find((d) => d._id === form.preferredDayPatternId) ?? null;
      const ts = timeSlots.find((t) => t._id === form.preferredTimeSlotId) ?? null;
      const row: RequestItem = res.data?.request ?? {
        _id: `req_local_${Date.now()}`,
        name: form.name.trim(),
        mobile: form.mobile,
        email: form.email || null,
        preferredDays: dp ? { _id: dp._id, label: dp.label } : null,
        preferredTime: ts ? { _id: ts._id, label: ts.label } : null,
        instrument,
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date().toISOString(),
      };
      setRequests((prev) => [row, ...(prev ?? [])]);
      toast.success("Enrollment request created");
      setCreating(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<RequestItem>[] = [
    {
      key: "name",
      label: "Applicant",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{formatPhone(r.mobile)}</p>
        </div>
      ),
    },
    { key: "instrument", label: "Instrument", render: (r) => r.instrument?.name ?? "—" },
    {
      key: "preference",
      label: "Preferred Slot",
      render: (r) =>
        r.preferredDays || r.preferredTime ? (
          <span className="text-xs">
            {r.preferredDays?.label ?? "Any days"} · {r.preferredTime?.label ?? "Any time"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No preference</span>
        ),
    },
    { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Received", render: (r) => <span className="text-xs">{formatDate(r.createdAt)}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="brand"
              className="rounded-full"
              onClick={() => setApproving(r)}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setRejecting(r);
                setRejectReason("");
              }}
            >
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <PageShell
      title="New Requests"
      subtitle={`${counts.pending} pending · ${counts.all} total enrollment requests`}
      actions={
        <Button variant="brand" className="group rounded-full" onClick={() => setCreating(true)}>
          New Request
          <Plus className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </Button>
      }
    >
      {/* Status filter pills */}
      <BlurFade delay={0.1}>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1 sm:w-fit">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold capitalize transition-all",
                filter === f
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {!requests ? (
          <TableSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={filter === "pending" ? "No pending requests" : "No requests here"}
            hint="New enrollment requests from prospective students will appear in this queue."
            action={
              <Button variant="brand" className="group rounded-full" onClick={() => setCreating(true)}>
                Add a request
                <Plus className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            }
          />
        ) : (
          <Table columns={columns} data={visible} />
        )}
      </BlurFade>

      {/* Approve — full "Request Details" edit form; on success the new
          student is immediately visible in the Students tab. */}
      <ApproveRequestModal
        request={approving}
        onClose={() => setApproving(null)}
        onApproved={(requestId) => {
          setRequests((prev) =>
            (prev ?? []).map((r) =>
              r._id === requestId ? { ...r, status: "approved" } : r
            )
          );
        }}
      />

      {/* Reject confirm */}
      <ConfirmModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject enrollment request"
        message={rejecting ? `Reject the request from ${rejecting.name}?` : undefined}
        confirmLabel="Reject Request"
        destructive
        onConfirm={reject}
      >
        <Input
          label="Reason (optional)"
          placeholder="e.g. No seats available in preferred slot"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </ConfirmModal>

      {/* New request modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Enrollment Request"
        subtitle="Capture a walk-in or phone enquiry"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={createRequest} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Student name"
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mobile"
              required
              placeholder="10-digit mobile"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Optional"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <Select
            label="Instrument"
            placeholder="Select instrument"
            options={instruments.map((i) => ({ value: i._id, label: i.name }))}
            value={form.instrumentId}
            onChange={(v) => setForm({ ...form, instrumentId: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Preferred days"
              placeholder="Any"
              options={dayPatterns.filter((d) => d.isActive).map((d) => ({
                value: d._id,
                label: d.label,
              }))}
              value={form.preferredDayPatternId}
              onChange={(v) => setForm({ ...form, preferredDayPatternId: v })}
            />
            <Select
              label="Preferred time"
              placeholder="Any"
              options={timeSlots.map((t) => ({ value: t._id, label: t.label }))}
              value={form.preferredTimeSlotId}
              onChange={(v) => setForm({ ...form, preferredTimeSlotId: v })}
            />
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
