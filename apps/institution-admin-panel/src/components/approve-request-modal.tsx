"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Modal, Select } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { calcDaysAndClasses } from "@/lib/schedule-calc";
import { RemarksField } from "@/components/remarks-field";
import {
  MOCK_BATCHES, MOCK_DAY_PATTERNS, MOCK_INSTRUMENTS, MOCK_TEACHERS, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, ClassLevelItem, DayPatternItem, Paginated, RequestItem, TeacherRow,
} from "@/lib/types";

// Derived payment status preview (mirrors backend config/payments).
function derivePaymentStatus(feeTotal: number, paid: number): "unpaid" | "partial" | "paid" | "free" {
  if (feeTotal <= 0) return "free";
  if (paid <= 0) return "unpaid";
  if (paid < feeTotal) return "partial";
  return "paid";
}

// "Request Details" approval form — approving a request is an EDIT step, not a
// one-click action: the admin completes the student's enrollment details and
// the approved student immediately appears in the Students tab.

interface ApprovedStudent {
  _id: string;
  displayId: string;
  name: string;
}

export interface ApproveRequestModalProps {
  request: RequestItem | null;
  onClose: () => void;
  /** Called after a successful approve so the page can update its list. */
  onApproved: (requestId: string, student: ApprovedStudent | null) => void;
}

const MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];
const SESSION_OPTIONS = [
  { value: "live", label: "Live" },
  { value: "all", label: "All" },
];
const JOIN_STATUS_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "active_soon", label: "Active Soon" },
  { value: "active", label: "Active" },
];
const CLASS_TYPE_OPTIONS = [
  { value: "Group", label: "Group" },
  { value: "One-to-One", label: "One-to-One" },
];
const PAYMENT_OPTIONS = [
  { value: "unpaid", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "free", label: "Free" },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ApproveRequestModal({ request, onClose, onApproved }: ApproveRequestModalProps) {
  // Select option sources (active records only).
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [dayPatterns, setDayPatterns] = useState<DayPatternItem[]>([]);
  const [instruments, setInstruments] = useState<{ _id: string; name: string }[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevelItem[]>([]);

  // Form state.
  const [classLevelId, setClassLevelId] = useState<string | null>(null);
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>("online");
  const [sessionType, setSessionType] = useState<string | null>("live");
  const [joinStatus, setJoinStatus] = useState<string | null>("trial");
  const [classType, setClassType] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>("unpaid");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalFeeRupees, setTotalFeeRupees] = useState("");
  const [paidRupees, setPaidRupees] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset + prefill from the request (and its proposed config) each time it opens.
  useEffect(() => {
    if (!request) return;
    const p = request.proposed ?? {};
    setClassLevelId(p.classLevelId ?? null);
    setInstrumentId(p.instrumentId ?? request.instrument?._id ?? null);
    setMode(p.mode ?? "online");
    setSessionType(p.sessionType ?? "live");
    setJoinStatus(p.joinStatus ?? "trial");
    setClassType(p.classType ?? null);
    setPaymentStatus(request.paymentStatus);
    setTeacherId(p.teacherId ?? null);
    setBatchId(p.batchId ?? null);
    const today = new Date();
    setStartDate(p.validityStart ? p.validityStart.slice(0, 10) : isoDate(today));
    setEndDate(
      p.validityEnd ? p.validityEnd.slice(0, 10) : isoDate(new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000))
    );
    setTotalFeeRupees(p.feeTotal ? String(Math.round(p.feeTotal / 100)) : "");
    setPaidRupees(p.paidAmount ? String(Math.round(p.paidAmount / 100)) : "");
    setRemarks(p.remarks ?? "");
  }, [request]);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    Promise.all([
      mockable(
        () => api.get<ApiResponse<Paginated<BatchRow>>>(adminPath("/batches?page=1&limit=100")),
        ok(paginate(MOCK_BATCHES))
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<TeacherRow>>>(adminPath("/teachers?page=1&limit=100")),
        ok(paginate(MOCK_TEACHERS))
      ),
      mockable(
        () => api.get<ApiResponse<{ dayPatterns: DayPatternItem[] } | Paginated<DayPatternItem>>>(
          adminPath("/day-patterns")
        ),
        ok(paginate(MOCK_DAY_PATTERNS))
      ),
      mockable(
        () => api.get<ApiResponse<{ instruments: { _id: string; name: string }[] }>>(adminPath("/instruments")),
        ok({ instruments: MOCK_INSTRUMENTS })
      ),
      mockable(
        () => api.get<ApiResponse<{ classLevels: ClassLevelItem[] }>>(adminPath("/class-levels?active=1")),
        ok({ classLevels: [] as ClassLevelItem[] })
      ),
    ]).then(([b, t, d, i, c]) => {
      if (cancelled) return;
      setBatches((b.data && "items" in b.data ? b.data.items : []) as BatchRow[]);
      setTeachers((t.data && "items" in t.data ? t.data.items : []) as TeacherRow[]);
      const dp = d.data && ("items" in d.data ? d.data.items : (d.data as { dayPatterns: DayPatternItem[] }).dayPatterns);
      setDayPatterns(dp ?? []);
      setInstruments((i.data as { instruments: { _id: string; name: string }[] })?.instruments ?? []);
      setClassLevels((c.data as { classLevels: ClassLevelItem[] })?.classLevels ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Only ACTIVE day patterns participate in scheduling/calculation.
  const activePatternDays = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of dayPatterns) if (p.isActive) map.set(p._id, p.days);
    return map;
  }, [dayPatterns]);

  const selectedBatch = batches.find((b) => b._id === batchId) ?? null;
  const patternDays = selectedBatch?.dayPattern
    ? activePatternDays.get(selectedBatch.dayPattern._id) ?? null
    : null;

  const calc = useMemo(
    () => calcDaysAndClasses(startDate || null, endDate || null, patternDays),
    [startDate, endDate, patternDays]
  );

  // Picking a class level pre-fills the total fee + validity window.
  const onClass = (id: string | null) => {
    setClassLevelId(id);
    const c = classLevels.find((x) => x._id === id);
    if (!c) return;
    setTotalFeeRupees(String(Math.round(c.upcomingAmount / 100)));
    if (c.paidAmount > 0) setPaidRupees(String(Math.round(c.paidAmount / 100)));
    const start = startDate || isoDate(new Date());
    setStartDate(start);
    const end = new Date(start);
    end.setDate(end.getDate() + c.days);
    setEndDate(isoDate(end));
  };

  const totalPaise = totalFeeRupees ? Math.round(Number(totalFeeRupees) * 100) : 0;
  const paidPaise = paidRupees ? Math.round(Number(paidRupees) * 100) : 0;
  const previewStatus =
    paymentStatus === "free" ? "free" : derivePaymentStatus(totalPaise, paidPaise);
  const remainingPaise = Math.max(0, totalPaise - paidPaise);

  const submit = async () => {
    if (!request) return;
    if (!instrumentId) {
      toast.error("Select an instrument");
      return;
    }
    if (!batchId) {
      toast.error("Select a batch");
      return;
    }
    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      toast.error("Pick a valid start and end date");
      return;
    }
    setSaving(true);
    try {
      const body = {
        classLevelId: classLevelId ?? undefined,
        instrumentId,
        mode: mode ?? undefined,
        sessionType: sessionType ?? undefined,
        joinStatus: joinStatus ?? undefined,
        classType: classType ?? undefined,
        paymentStatus: paymentStatus ?? undefined,
        teacherId: teacherId ?? undefined,
        batchId,
        validityStart: startDate,
        validityEnd: endDate,
        validityDays: calc.days,
        upcomingClasses: calc.classes,
        feeTotal: totalPaise || undefined,
        paidAmount: paidPaise || undefined,
        remarks: remarks.trim() || undefined,
      };
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ student: ApprovedStudent; tempPassword: string }>>(
            adminPath(`/requests/${request._id}/approve`),
            body
          ),
        ok({
          student: { _id: `stu_local_${request._id}`, displayId: "STU-NEW", name: request.name },
          tempPassword: "demo-pass-123",
        }),
        500
      );
      const student = res.data?.student ?? null;
      toast.success(`${request.name} approved — now visible in the Students tab`, {
        description: res.data?.tempPassword
          ? `Temporary password: ${res.data.tempPassword}`
          : undefined,
        duration: 8000,
      });
      onApproved(request._id, student);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve the request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!request}
      onClose={() => !saving && onClose()}
      title="Request Details"
      subtitle="Complete the student's enrollment information to approve"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Approve &amp; Create Student
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {request && (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{request.name}</span> · {request.mobile}
            {request.preferredDays || request.preferredTime ? (
              <> · prefers {request.preferredDays?.label ?? "any days"}, {request.preferredTime?.label ?? "any time"}</>
            ) : null}
          </div>
        )}

        <Select
          label="Class level (auto-fills fee + validity)"
          placeholder={classLevels.length ? "Select a class" : "No class levels configured"}
          options={classLevels.map((c) => ({ value: c._id, label: `${c.name} · ₹${Math.round(c.upcomingAmount / 100)} · ${c.days}d` }))}
          value={classLevelId}
          onChange={onClass}
        />
        <Select
          label="Instrument"
          required
          placeholder="Select instrument"
          options={instruments.map((i) => ({ value: i._id, label: i.name }))}
          value={instrumentId}
          onChange={setInstrumentId}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Mode" required options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <Select label="Session Type" required options={SESSION_OPTIONS} value={sessionType} onChange={setSessionType} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Join Status" required options={JOIN_STATUS_OPTIONS} value={joinStatus} onChange={setJoinStatus} />
          <Select
            label="Class Type"
            placeholder="Select class type"
            options={CLASS_TYPE_OPTIONS}
            value={classType}
            onChange={setClassType}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Total Fee (₹)"
            type="number"
            min={0}
            placeholder="e.g. 8997"
            value={totalFeeRupees}
            onChange={(e) => setTotalFeeRupees(e.target.value)}
          />
          <Input
            label="Paid now (₹)"
            type="number"
            min={0}
            placeholder="e.g. 4000"
            value={paidRupees}
            onChange={(e) => setPaidRupees(e.target.value)}
          />
          <Select label="Payment" required options={PAYMENT_OPTIONS} value={paymentStatus} onChange={setPaymentStatus} />
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
          Status will be{" "}
          <span className="font-semibold uppercase tracking-wide text-foreground">{previewStatus}</span>
          {previewStatus === "partial" && (
            <> · <span className="font-semibold text-amber-600 dark:text-amber-500">{formatCurrency(remainingPaise)} left</span></>
          )}
        </div>
        <Select
          label="Teacher"
          placeholder="Select teacher (optional)"
          options={teachers
            .filter((t) => t.status === "active")
            .map((t) => ({ value: t._id, label: t.name }))}
          value={teacherId}
          onChange={setTeacherId}
        />
        <Select
          label="Batch Name/Code"
          required
          placeholder="Select batch"
          options={batches
            .filter((b) => b.status === "active" || b.status === "setting")
            .map((b) => ({ value: b._id, label: b.name }))}
          value={batchId}
          onChange={setBatchId}
        />
        {selectedBatch && !patternDays && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            This batch&apos;s day pattern is inactive — re-enable it under Suitable Days to calculate classes.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Days (Calculated)" readOnly value={String(calc.days)} className="bg-muted/50" />
          <Input label="Classes (Calculated)" readOnly value={String(calc.classes)} className="bg-muted/50" />
        </div>
        <RemarksField value={remarks} onChange={setRemarks} placeholder="Internal notes / observations…" />
      </div>
    </Modal>
  );
}
