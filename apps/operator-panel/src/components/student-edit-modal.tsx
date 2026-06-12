"use client";
// Operator god-mode "Edit Student" — FULL PARITY with the institution admin
// student edit form (same sections, fields and backend whitelist), plus the
// operator's live activity rail. The institution is a read-only chip (operator
// edits a student inside its OWN institution; structural refs are validated
// server-side against that institution). PATCH /api/operator/students/:id.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { BorderBeam, Button, Input, Select, StatusBadge } from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { ActivityGraph } from "@/components/activity-graph";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { calcDaysAndClasses } from "@/lib/schedule-calc";
import {
  mockEntityActivity, mockStudentCatalog, mockStudentDetail,
} from "@/lib/mocks";
import type {
  ApiResponse, AuditLogItem, OperatorStudentCatalog, OperatorStudentRow,
  Paginated, StudentDetail,
} from "@/lib/types";

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

function derivePaymentStatus(feeTotal: number, paid: number): OperatorStudentRow["paymentStatus"] {
  if (feeTotal <= 0) return "free";
  if (paid <= 0) return "unpaid";
  if (paid < feeTotal) return "partial";
  return "paid";
}
function dateInput(v: string | null): string {
  return v ? v.slice(0, 10) : "";
}

export function StudentEditModal({
  student,
  onClose,
  onSaved,
}: {
  student: OperatorStudentRow;
  onClose: () => void;
  onSaved: (patch: Partial<OperatorStudentRow>) => void;
}) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [catalog, setCatalog] = useState<OperatorStudentCatalog | null>(null);
  const [entries, setEntries] = useState<AuditLogItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [liveBatch, setLiveBatch] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ── form fields (initialised once the detail arrives) ──────────────────────
  const [classLevelId, setClassLevelId] = useState<string | null>(null);
  const [feeRupees, setFeeRupees] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [instrumentId, setInstrumentId] = useState<string | null>(null);
  const [classType, setClassType] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("active");
  const [validityStart, setValidityStart] = useState("");
  const [validityEnd, setValidityEnd] = useState("");
  const [paidClasses, setPaidClasses] = useState("0");
  const [upcomingClasses, setUpcomingClasses] = useState("0");
  const [paidRupees, setPaidRupees] = useState("0");
  const [upcomingRupees, setUpcomingRupees] = useState("0");

  // Fetch detail + catalog + activity.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockable(
        () => api.get<ApiResponse<StudentDetail>>(`/api/operator/students/${student._id}`),
        mockStudentDetail(student)
      ),
      mockable(
        () => api.get<ApiResponse<OperatorStudentCatalog>>(`/api/operator/students/${student._id}/catalog`),
        mockStudentCatalog()
      ),
    ]).then(([d, c]) => {
      if (cancelled || !d.data) return;
      setCatalog(c.data ?? null);
      const det = d.data;
      setDetail(det);
      setFeeRupees(String(Math.round(det.feeTotal / 100)));
      setRemarks(det.remarks ?? "");
      setTeacherId(det.teacher?._id ?? null);
      setBatchId(det.batch?._id ?? null);
      setClassLevelId(det.classLevel?._id ?? null);
      setClassType(det.classType);
      setMode(det.mode);
      setSessionType(det.sessionType);
      setJoinStatus(det.joinStatus);
      setCategory(det.category);
      setValidityStart(dateInput(det.validityStart));
      setValidityEnd(dateInput(det.validityEnd));
      setPaidClasses(String(det.paidClasses));
      setUpcomingClasses(String(det.upcomingClasses));
      setPaidRupees(String(Math.round(det.paidAmount / 100)));
      setUpcomingRupees(String(Math.round(det.upcomingAmount / 100)));
      // resolve instrument id from name against the catalog
      const match = (c.data?.instruments ?? []).find((i) => i.name === det.instrument);
      setInstrumentId(match?._id ?? null);
    });

    setActivityLoading(true);
    mockable(
      () =>
        api.get<ApiResponse<Paginated<AuditLogItem>>>(
          `/api/operator/changes?entityType=Student&entityId=${student._id}&limit=50`
        ),
      mockEntityActivity(student._id)
    )
      .then((r) => !cancelled && r.data && setEntries(r.data.items))
      .catch(() => {})
      .finally(() => !cancelled && setActivityLoading(false));

    return () => {
      cancelled = true;
    };
  }, [student._id]);

  // Escape + scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [saving, onClose]);

  const patternDays = useMemo(() => {
    const batch = (catalog?.batches ?? []).find((b) => b._id === batchId);
    if (!batch?.dayPattern) return null;
    const p = (catalog?.dayPatterns ?? []).find((x) => x._id === batch.dayPattern!._id && x.isActive);
    return p?.days ?? null;
  }, [catalog, batchId]);

  const calc = useMemo(
    () => calcDaysAndClasses(validityStart || null, validityEnd || null, patternDays),
    [validityStart, validityEnd, patternDays]
  );

  const onClass = (id: string | null) => {
    setClassLevelId(id);
    const c = (catalog?.classLevels ?? []).find((x) => x._id === id);
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
    if (!detail || !catalog) return;
    const paidAmount = Math.round(Number(paidRupees || 0) * 100);
    const upcomingAmount = Math.round(Number(upcomingRupees || 0) * 100);
    const feeTotal = feePaise;

    setSaving(true);
    try {
      const res = await mockable(
        () =>
          api.patch<ApiResponse<StudentDetail>>(`/api/operator/students/${student._id}`, {
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
          }),
        mockStudentDetail({
          ...student,
          joinStatus: (joinStatus as OperatorStudentRow["joinStatus"]) ?? student.joinStatus,
          paidAmount, upcomingAmount, feeTotal,
          remainingAmount: Math.max(0, feeTotal - paidAmount),
          paymentStatus: derivePaymentStatus(feeTotal, paidAmount),
          remarks: remarks.trim() || null,
          validityEnd: validityEnd || null,
          teacher: teacherId ? { _id: teacherId, name: catalog.teachers.find((t) => t._id === teacherId)?.name ?? "" } : null,
          batch: batchId ? { _id: batchId, name: catalog.batches.find((b) => b._id === batchId)?.name ?? "" } : null,
          instrument: catalog.instruments.find((i) => i._id === instrumentId)?.name ?? student.instrument,
        }),
        500
      );

      const teacher = catalog.teachers.find((t) => t._id === teacherId) ?? null;
      const batch = catalog.batches.find((b) => b._id === batchId) ?? null;
      const rowPatch: Partial<OperatorStudentRow> = {
        joinStatus: (joinStatus as OperatorStudentRow["joinStatus"]) ?? student.joinStatus,
        paidAmount, upcomingAmount, feeTotal,
        remainingAmount: Math.max(0, feeTotal - paidAmount),
        paymentStatus: derivePaymentStatus(feeTotal, paidAmount),
        remarks: remarks.trim() || null,
        validityEnd: validityEnd || null,
        teacher: teacher ? { _id: teacher._id, name: teacher.name } : null,
        batch: batch ? { _id: batch._id, name: batch.name } : null,
        instrument: catalog.instruments.find((i) => i._id === instrumentId)?.name ?? student.instrument,
        classLevel: classLevelId
          ? { _id: classLevelId, name: catalog.classLevels.find((c) => c._id === classLevelId)?.name ?? "" }
          : null,
      };
      onSaved(rowPatch);
      if (res.data) setDetail(res.data);

      // refresh the activity rail (newest entries animate in)
      const fresh = await mockable(
        () =>
          api.get<ApiResponse<Paginated<AuditLogItem>>>(
            `/api/operator/changes?entityType=Student&entityId=${student._id}&limit=50`
          ),
        mockEntityActivity(student._id)
      );
      if (fresh.data) {
        const prevIds = new Set(entries.map((e) => e._id));
        setEntries(fresh.data.items);
        setLiveBatch(fresh.data.items.filter((e) => !prevIds.has(e._id)).map((e) => e._id));
      }
      toast.success(`${student.name} updated — change recorded in the activity log`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex h-[min(680px,90vh)] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <BorderBeam size={90} duration={9} />

          {/* LEFT — edit form */}
          <div className="flex min-w-0 flex-1 flex-col lg:basis-[58%]">
            <div className="shrink-0 border-b border-border px-6 py-5">
              <h2 className="text-lg font-semibold">Edit Student</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {student.displayId} · {student.institution.name}
              </p>
            </div>

            {!detail || !catalog ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                {/* Course configuration */}
                <section className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand">Course Configuration</h3>
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
                      label="Instrument" placeholder="Select instrument"
                      options={catalog.instruments.map((i) => ({ value: i._id, label: i.name }))}
                      value={instrumentId} onChange={setInstrumentId}
                    />
                    <Select label="Class Type" placeholder="—" options={CLASS_TYPE_OPTIONS} value={classType} onChange={setClassType} />
                  </div>
                  <Select
                    label="Class level (auto-fills fee + validity)"
                    placeholder={catalog.classLevels.length ? "Select a class" : "No class levels configured"}
                    options={catalog.classLevels.map((c) => ({ value: c._id, label: `${c.name} · ₹${Math.round(c.upcomingAmount / 100)} · ${c.days}d` }))}
                    value={classLevelId} onChange={onClass}
                  />
                </section>

                {/* Batch & schedule */}
                <section className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand">Batch &amp; Schedule</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Teacher" placeholder="Not assigned"
                      options={catalog.teachers.map((t) => ({ value: t._id, label: t.name }))}
                      value={teacherId} onChange={setTeacherId}
                    />
                    <Select
                      label="Batch Name/Code" placeholder="Not assigned"
                      options={catalog.batches.map((b) => ({ value: b._id, label: b.name }))}
                      value={batchId} onChange={setBatchId}
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

                {/* Financials & admin */}
                <section className="flex flex-col gap-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand">Financials &amp; Admin</h3>
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
                  <label className="flex w-full flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground">Remarks / Observations</span>
                    <textarea
                      rows={2}
                      placeholder="Internal notes / observations…"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    />
                  </label>
                  <Select label="Account Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
                </section>

                {/* Institution — read-only (operator can't move a student across schools) */}
                <section className="rounded-lg border border-border/70 bg-muted/30 p-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Institution</h3>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Tag>{student.institution.name}</Tag>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    A student always belongs to one institution — enrolment school is fixed.
                  </p>
                </section>
              </div>
            )}

            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button variant="brand" onClick={save} disabled={saving || !detail}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </div>

          {/* RIGHT — live activity rail */}
          <aside className="hidden min-h-0 w-[42%] shrink-0 border-l border-border bg-muted/10 lg:flex lg:flex-col">
            <ActivityGraph entries={entries} liveBatch={liveBatch} loading={activityLoading} />
          </aside>

          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
