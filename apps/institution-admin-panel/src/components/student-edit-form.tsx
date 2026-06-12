"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select, StatusBadge } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { calcDaysAndClasses } from "@/lib/schedule-calc";
import { RemarksField } from "@/components/remarks-field";
import {
  MOCK_BATCHES, MOCK_DAY_PATTERNS, MOCK_INSTRUMENTS, MOCK_TEACHERS, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, ClassLevelItem, DayPatternItem, Paginated, StudentDetail, TeacherRow,
} from "@/lib/types";

function derivePaymentStatus(feeTotal: number, paid: number): "unpaid" | "partial" | "paid" | "free" {
  if (feeTotal <= 0) return "free";
  if (paid <= 0) return "unpaid";
  if (paid < feeTotal) return "partial";
  return "paid";
}

// Whitelisted-field edit form (mirrors PATCH /students/:id). Every change is
// reported back as {field, from, to} so the caller can surface it in the
// Recent Activity timeline immediately — the same "every tiny edit is
// recorded" behavior the operator panel has.

export interface StudentEditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface StudentEditFormProps {
  detail: StudentDetail;
  onSaved: (updated: StudentDetail, changes: StudentEditChange[], action: string) => void;
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
  { value: "inactive", label: "Inactive" },
];
const CLASS_TYPE_OPTIONS = [
  { value: "Group", label: "Group" },
  { value: "One-to-One", label: "One-to-One" },
];
const CATEGORY_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "trial", label: "Trial" },
];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "hold", label: "Hold (paused — can still log in)" },
  { value: "inactive", label: "Inactive" },
];

function dateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

export function StudentEditForm({ detail, onSaved }: StudentEditFormProps) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [dayPatterns, setDayPatterns] = useState<DayPatternItem[]>([]);
  const [instruments, setInstruments] = useState<{ _id: string; name: string }[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevelItem[]>([]);

  const [classLevelId, setClassLevelId] = useState<string | null>(detail.classLevel?._id ?? null);
  const [feeRupees, setFeeRupees] = useState(String(Math.round(detail.feeTotal / 100)));
  const [remarks, setRemarks] = useState(detail.remarks ?? "");
  const [teacherId, setTeacherId] = useState<string | null>(detail.teacher?._id ?? null);
  const [batchId, setBatchId] = useState<string | null>(detail.batch?._id ?? null);
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [classType, setClassType] = useState<string | null>(detail.classType);
  const [mode, setMode] = useState<string | null>(detail.mode);
  const [sessionType, setSessionType] = useState<string | null>(detail.sessionType);
  const [joinStatus, setJoinStatus] = useState<string | null>(detail.joinStatus);
  const [category, setCategory] = useState<string | null>(detail.category);
  const [status, setStatus] = useState<string | null>(detail.accountStatus);
  const [validityStart, setValidityStart] = useState(dateInput(detail.validityStart));
  const [validityEnd, setValidityEnd] = useState(dateInput(detail.validityEnd));
  const [paidClasses, setPaidClasses] = useState(String(detail.paidClasses));
  const [upcomingClasses, setUpcomingClasses] = useState(String(detail.upcomingClasses));
  const [paidRupees, setPaidRupees] = useState(String(Math.round(detail.paidAmount / 100)));
  const [upcomingRupees, setUpcomingRupees] = useState(String(Math.round(detail.upcomingAmount / 100)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        () => api.get<ApiResponse<{ instruments: { _id: string; name: string; isActive: boolean }[] }>>(
          adminPath("/instruments")
        ),
        ok({ instruments: MOCK_INSTRUMENTS.map((i) => ({ ...i, isActive: true })) })
      ),
      mockable(
        () => api.get<ApiResponse<{ classLevels: ClassLevelItem[] }>>(adminPath("/class-levels?active=1")),
        ok({ classLevels: [] as ClassLevelItem[] })
      ),
    ]).then(([b, t, d, ins, cls]) => {
      if (cancelled) return;
      setBatches((b.data && "items" in b.data ? b.data.items : []) as BatchRow[]);
      setTeachers((t.data && "items" in t.data ? t.data.items : []) as TeacherRow[]);
      const dp = d.data && ("items" in d.data ? d.data.items : (d.data as { dayPatterns: DayPatternItem[] }).dayPatterns);
      setDayPatterns(dp ?? []);
      setInstruments((ins.data?.instruments ?? []).map((i) => ({ _id: i._id, name: i.name })));
      setClassLevels((cls.data as { classLevels: ClassLevelItem[] })?.classLevels ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // StudentDetail carries the instrument NAME; resolve the id against the
  // institution's REAL instrument catalog (mock ids fail refGuard in live mode).
  useEffect(() => {
    if (!detail.instrument || !instruments.length) return;
    const match = instruments.find((i) => i.name === detail.instrument);
    if (match) setInstrumentId(match._id);
  }, [detail.instrument, instruments]);

  // Only active day patterns drive the recalculated classes hint.
  const patternDays = useMemo(() => {
    const batch = batches.find((b) => b._id === batchId);
    if (!batch?.dayPattern) return null;
    const p = dayPatterns.find((x) => x._id === batch.dayPattern!._id && x.isActive);
    return p?.days ?? null;
  }, [batches, batchId, dayPatterns]);

  const calc = useMemo(
    () => calcDaysAndClasses(validityStart || null, validityEnd || null, patternDays),
    [validityStart, validityEnd, patternDays]
  );

  // Picking a class level pre-fills total fee + validity window.
  const onClass = (id: string | null) => {
    setClassLevelId(id);
    const c = classLevels.find((x) => x._id === id);
    if (!c) return;
    setFeeRupees(String(Math.round(c.upcomingAmount / 100)));
    const start = validityStart || new Date().toISOString().slice(0, 10);
    setValidityStart(start);
    const end = new Date(start);
    end.setDate(end.getDate() + c.days);
    setValidityEnd(end.toISOString().slice(0, 10));
  };

  const feePaise = Math.round(Number(feeRupees || 0) * 100);
  const paidPreviewPaise = Math.round(Number(paidRupees || 0) * 100);
  const previewStatus = derivePaymentStatus(feePaise, paidPreviewPaise);
  const remainingPreview = Math.max(0, feePaise - paidPreviewPaise);

  const save = async () => {
    const paidAmount = Math.round(Number(paidRupees || 0) * 100);
    const upcomingAmount = Math.round(Number(upcomingRupees || 0) * 100);
    const feeTotal = feePaise;

    const teacherName = (id: string | null) =>
      id ? teachers.find((t) => t._id === id)?.name ?? id : null;
    const batchName = (id: string | null) =>
      id ? batches.find((b) => b._id === id)?.name ?? id : null;
    const instrumentName = (id: string | null) =>
      id ? instruments.find((i) => i._id === id)?.name ?? id : null;

    // Human-readable diffs for the activity timeline.
    const changes: StudentEditChange[] = [];
    const push = (field: string, from: unknown, to: unknown) => {
      if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) changes.push({ field, from, to });
    };
    push("teacher", detail.teacher?.name ?? null, teacherName(teacherId));
    push("batch", detail.batch?.name ?? null, batchName(batchId));
    push("instrument", detail.instrument, instrumentName(instrumentId) ?? detail.instrument);
    push("classType", detail.classType, classType);
    push("mode", detail.mode, mode);
    push("sessionType", detail.sessionType, sessionType);
    push("joinStatus", detail.joinStatus, joinStatus);
    push("category", detail.category, category);
    push("validityStart", dateInput(detail.validityStart), validityStart || null);
    push("validityEnd", dateInput(detail.validityEnd), validityEnd || null);
    push("paidClasses", detail.paidClasses, Number(paidClasses || 0));
    push("upcomingClasses", detail.upcomingClasses, Number(upcomingClasses || 0));
    push("paidAmount", detail.paidAmount, paidAmount);
    push("upcomingAmount", detail.upcomingAmount, upcomingAmount);
    push("feeTotal", detail.feeTotal, feeTotal);
    push("classLevel", detail.classLevel?.name ?? null, classLevels.find((c) => c._id === classLevelId)?.name ?? null);
    push("remarks", detail.remarks ?? null, remarks.trim() || null);
    push("status", detail.accountStatus, status);

    if (!changes.length) {
      toast.info("Nothing changed");
      return;
    }

    setSaving(true);
    try {
      await mockable(
        () =>
          api.patch<ApiResponse<{ student: { _id: string } }>>(
            adminPath(`/students/${detail._id}`),
            {
              teacherId: teacherId ?? null,
              batchId: batchId ?? null,
              instrumentId: instrumentId ?? undefined,
              classType: classType ?? undefined,
              mode: mode ?? undefined,
              sessionType: sessionType ?? undefined,
              joinStatus: joinStatus ?? undefined,
              category: category ?? undefined,
              status: status ?? undefined,
              validityStart: validityStart || undefined,
              validityEnd: validityEnd || undefined,
              validityDays: calc.days || undefined,
              paidClasses: Number(paidClasses || 0),
              upcomingClasses: Number(upcomingClasses || 0),
              paidAmount,
              upcomingAmount,
              feeTotal,
              classLevelId: classLevelId ?? null,
              remarks: remarks.trim() || undefined,
            }
          ),
        ok({ student: { _id: detail._id } }),
        450
      );

      const moneyOnly = changes.every(
        (c) => c.field === "paidAmount" || c.field === "upcomingAmount" || c.field === "feeTotal"
      );
      const action = moneyOnly ? "UPDATE_PAID_AMOUNT" : "UPDATE_STUDENT";

      const batch = batches.find((b) => b._id === batchId) ?? null;
      const teacher = teachers.find((t) => t._id === teacherId) ?? null;
      const updated: StudentDetail = {
        ...detail,
        teacher: teacher ? { _id: teacher._id, name: teacher.name } : null,
        batch: batch ? { _id: batch._id, name: batch.name } : null,
        instrument: instrumentName(instrumentId) ?? detail.instrument,
        classType,
        mode: (mode as StudentDetail["mode"]) ?? detail.mode,
        sessionType: (sessionType as StudentDetail["sessionType"]) ?? detail.sessionType,
        joinStatus: (joinStatus as StudentDetail["joinStatus"]) ?? detail.joinStatus,
        accountStatus: (status as StudentDetail["accountStatus"]) ?? detail.accountStatus,
        category: (category as StudentDetail["category"]) ?? detail.category,
        validityStart: validityStart || null,
        validityEnd: validityEnd || null,
        validityDays: calc.days || detail.validityDays,
        paidClasses: Number(paidClasses || 0),
        upcomingClasses: Number(upcomingClasses || 0),
        paidAmount,
        upcomingAmount,
        feeTotal,
        remainingAmount: Math.max(0, feeTotal - paidAmount),
        paymentStatus: derivePaymentStatus(feeTotal, paidAmount),
        remarks: remarks.trim() || null,
        classLevel: classLevelId
          ? { _id: classLevelId, name: classLevels.find((c) => c._id === classLevelId)?.name ?? "" }
          : null,
        schedule: batch
          ? { days: batch.dayPattern?.label ?? null, time: batch.timeSlot?.label ?? null }
          : { days: null, time: null },
      };

      toast.success(`${detail.name} updated — change recorded in the activity log`);
      onSaved(updated, changes, action);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── COURSE CONFIGURATION ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand">Course Configuration</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <Select label="Join Status" options={JOIN_STATUS_OPTIONS} value={joinStatus} onChange={setJoinStatus} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Session Type" options={SESSION_OPTIONS} value={sessionType} onChange={setSessionType} />
          <Select label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Instrument"
            placeholder="Select instrument"
            options={instruments.map((i) => ({ value: i._id, label: i.name }))}
            value={instrumentId}
            onChange={setInstrumentId}
          />
          <Select label="Class Type" placeholder="—" options={CLASS_TYPE_OPTIONS} value={classType} onChange={setClassType} />
        </div>
        <Select
          label="Class level (auto-fills fee + validity)"
          placeholder={classLevels.length ? "Select a class" : "No class levels configured"}
          options={classLevels.map((c) => ({ value: c._id, label: `${c.name} · ₹${Math.round(c.upcomingAmount / 100)} · ${c.days}d` }))}
          value={classLevelId}
          onChange={onClass}
        />
      </section>

      {/* ── BATCH & SCHEDULE ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand">Batch &amp; Schedule</h4>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Teacher"
            placeholder="Not assigned"
            options={teachers.filter((t) => t.status === "active").map((t) => ({ value: t._id, label: t.name }))}
            value={teacherId}
            onChange={setTeacherId}
          />
          <Select
            label="Batch Name/Code"
            placeholder="Not assigned"
            options={batches
              .filter((b) => b.status === "active" || b.status === "setting")
              .map((b) => ({ value: b._id, label: b.name }))}
            value={batchId}
            onChange={setBatchId}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={validityStart} onChange={(e) => setValidityStart(e.target.value)} />
          <Input label="End Date" type="date" value={validityEnd} onChange={(e) => setValidityEnd(e.target.value)} />
        </div>
        {calc.days > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {calc.days} days · {patternDays ? `${calc.classes} classes on the batch's active pattern` : "no active day pattern on the selected batch"}
          </p>
        )}
      </section>

      {/* ── FINANCIALS & ADMIN ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand">Financials &amp; Admin</h4>
        <div className="grid grid-cols-2 items-end gap-3">
          <Input label="Total Fee (₹)" type="number" min={0} value={feeRupees} onChange={(e) => setFeeRupees(e.target.value)} />
          <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
            <StatusBadge status={previewStatus} />
            {remainingPreview > 0 && (
              <span className="font-medium text-amber-600 dark:text-amber-500">{formatCurrency(remainingPreview)} left</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Paid Amount (₹)" type="number" min={0} value={paidRupees} onChange={(e) => setPaidRupees(e.target.value)} />
          <Input label="Upcoming Amount (₹)" type="number" min={0} value={upcomingRupees} onChange={(e) => setUpcomingRupees(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Paid Classes" type="number" min={0} value={paidClasses} onChange={(e) => setPaidClasses(e.target.value)} />
          <Input label="Upcoming Classes" type="number" min={0} value={upcomingClasses} onChange={(e) => setUpcomingClasses(e.target.value)} />
        </div>
        <RemarksField value={remarks} onChange={setRemarks} placeholder="Internal notes / observations…" />
        <Select label="Account Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </section>

      {/* Pinned save bar — separated from the scrolling content so it never
          merges into the dialog's bottom border. */}
      <div className="sticky bottom-0 z-10 -mx-1 mt-1 flex justify-end border-t border-border bg-card px-1 pb-1 pt-3">
        <Button variant="brand" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
