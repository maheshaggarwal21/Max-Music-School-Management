"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { calcDaysAndClasses } from "@/lib/schedule-calc";
import {
  MOCK_BATCHES, MOCK_DAY_PATTERNS, MOCK_INSTRUMENTS, MOCK_TEACHERS, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, DayPatternItem, Paginated, StudentDetail, TeacherRow,
} from "@/lib/types";

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
  { value: "inactive", label: "Inactive" },
];

function dateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

export function StudentEditForm({ detail, onSaved }: StudentEditFormProps) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [dayPatterns, setDayPatterns] = useState<DayPatternItem[]>([]);

  const [teacherId, setTeacherId] = useState<string | null>(detail.teacher?._id ?? null);
  const [batchId, setBatchId] = useState<string | null>(detail.batch?._id ?? null);
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [classType, setClassType] = useState<string | null>(detail.classType);
  const [mode, setMode] = useState<string | null>(detail.mode);
  const [sessionType, setSessionType] = useState<string | null>(detail.sessionType);
  const [joinStatus, setJoinStatus] = useState<string | null>(detail.joinStatus);
  const [category, setCategory] = useState<string | null>(detail.category);
  const [status, setStatus] = useState<string | null>("active");
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
    ]).then(([b, t, d]) => {
      if (cancelled) return;
      setBatches((b.data && "items" in b.data ? b.data.items : []) as BatchRow[]);
      setTeachers((t.data && "items" in t.data ? t.data.items : []) as TeacherRow[]);
      const dp = d.data && ("items" in d.data ? d.data.items : (d.data as { dayPatterns: DayPatternItem[] }).dayPatterns);
      setDayPatterns(dp ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // StudentDetail carries the instrument NAME; resolve the id for the select.
  useEffect(() => {
    if (!detail.instrument) return;
    const match = MOCK_INSTRUMENTS.find((i) => i.name === detail.instrument);
    if (match) setInstrumentId(match._id);
  }, [detail.instrument]);

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

  const save = async () => {
    const paidAmount = Math.round(Number(paidRupees || 0) * 100);
    const upcomingAmount = Math.round(Number(upcomingRupees || 0) * 100);

    const teacherName = (id: string | null) =>
      id ? teachers.find((t) => t._id === id)?.name ?? id : null;
    const batchName = (id: string | null) =>
      id ? batches.find((b) => b._id === id)?.name ?? id : null;
    const instrumentName = (id: string | null) =>
      id ? MOCK_INSTRUMENTS.find((i) => i.name && i._id === id)?.name ?? id : null;

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
            }
          ),
        ok({ student: { _id: detail._id } }),
        450
      );

      const moneyOnly = changes.every((c) => c.field === "paidAmount" || c.field === "upcomingAmount");
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
        category: (category as StudentDetail["category"]) ?? detail.category,
        validityStart: validityStart || null,
        validityEnd: validityEnd || null,
        validityDays: calc.days || detail.validityDays,
        paidClasses: Number(paidClasses || 0),
        upcomingClasses: Number(upcomingClasses || 0),
        paidAmount,
        upcomingAmount,
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Teacher"
          placeholder="Not assigned"
          options={teachers.filter((t) => t.status === "active").map((t) => ({ value: t._id, label: t.name }))}
          value={teacherId}
          onChange={setTeacherId}
        />
        <Select
          label="Batch"
          placeholder="Not assigned"
          options={batches
            .filter((b) => b.status === "active" || b.status === "setting")
            .map((b) => ({ value: b._id, label: b.name }))}
          value={batchId}
          onChange={setBatchId}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Instrument"
          placeholder="Select instrument"
          options={MOCK_INSTRUMENTS.map((i) => ({ value: i._id, label: i.name }))}
          value={instrumentId}
          onChange={setInstrumentId}
        />
        <Select label="Class Type" placeholder="—" options={CLASS_TYPE_OPTIONS} value={classType} onChange={setClassType} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        <Select label="Session Type" options={SESSION_OPTIONS} value={sessionType} onChange={setSessionType} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Join Status" options={JOIN_STATUS_OPTIONS} value={joinStatus} onChange={setJoinStatus} />
        <Select label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Validity Start" type="date" value={validityStart} onChange={(e) => setValidityStart(e.target.value)} />
        <Input label="Validity End" type="date" value={validityEnd} onChange={(e) => setValidityEnd(e.target.value)} />
      </div>
      {calc.days > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {calc.days} days · {patternDays ? `${calc.classes} classes on the batch's active pattern` : "no active day pattern on the selected batch"}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Paid Classes" type="number" min={0} value={paidClasses} onChange={(e) => setPaidClasses(e.target.value)} />
        <Input label="Upcoming Classes" type="number" min={0} value={upcomingClasses} onChange={(e) => setUpcomingClasses(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input label="Paid Amount (₹)" type="number" min={0} value={paidRupees} onChange={(e) => setPaidRupees(e.target.value)} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Stored as {formatCurrency(Math.round(Number(paidRupees || 0) * 100))}
          </p>
        </div>
        <div>
          <Input label="Upcoming Amount (₹)" type="number" min={0} value={upcomingRupees} onChange={(e) => setUpcomingRupees(e.target.value)} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Stored as {formatCurrency(Math.round(Number(upcomingRupees || 0) * 100))}
          </p>
        </div>
      </div>
      <Select label="Account Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />

      <div className="mt-1 flex justify-end">
        <Button variant="brand" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
