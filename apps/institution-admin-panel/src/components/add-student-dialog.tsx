"use client";
// Admin "Add Student" — creates an enrollment REQUEST carrying the proposed
// student config (class / fee / batch / validity / remarks). The request lands in
// New Requests for cross-check; approval (pre-filled, editable) creates the student.
// Selecting a Class level pre-fills the total fee + validity window. Amounts are
// entered in rupees and sent as paise (the stored unit).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Modal, Select } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_BATCHES, MOCK_INSTRUMENTS, MOCK_TEACHERS, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, ClassLevelItem, Paginated } from "@/lib/types";
import { RemarksField } from "@/components/remarks-field";

const GENDER = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];
const MODE = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
];
const SESSION = [
  { value: "live", label: "Live only" },
  { value: "all", label: "All sessions" },
];
const JOIN_STATUS = [
  { value: "trial", label: "Trial" },
  { value: "active_soon", label: "Active Soon" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const CATEGORY = [
  { value: "regular", label: "Regular" },
  { value: "trial", label: "Trial" },
];

const EMPTY = {
  name: "",
  mobile: "",
  email: "",
  gender: null as string | null,
  classLevelId: null as string | null,
  instrumentId: null as string | null,
  teacherId: null as string | null,
  batchId: null as string | null,
  mode: "online" as string | null,
  sessionType: "all" as string | null,
  joinStatus: "trial" as string | null,
  category: "regular" as string | null,
  validityStart: "",
  validityEnd: "",
  feeRupees: "",
  paidRupees: "",
  paidClasses: "",
  remarks: "",
};

type Named = { _id: string; name: string };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(startISO: string, days: number) {
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const s = new Date(a).getTime();
  const e = new Date(b).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return undefined;
  return Math.max(0, Math.round((e - s) / 86400000));
}

export function AddStudentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<Named[]>([]);
  const [teachers, setTeachers] = useState<Named[]>([]);
  const [batches, setBatches] = useState<Named[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevelItem[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    let alive = true;
    Promise.all([
      mockable(
        () => api.get<ApiResponse<{ instruments: { _id: string; name: string; isActive: boolean }[] }>>(adminPath("/instruments")),
        ok({ instruments: MOCK_INSTRUMENTS })
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<{ _id: string; name: string; status: string }>>>(adminPath("/teachers?page=1&limit=100")),
        ok(paginate(MOCK_TEACHERS))
      ),
      mockable(
        () => api.get<ApiResponse<Paginated<{ _id: string; name: string; status: string }>>>(adminPath("/batches?page=1&limit=100")),
        ok(paginate(MOCK_BATCHES))
      ),
      mockable(
        () => api.get<ApiResponse<{ classLevels: ClassLevelItem[] }>>(adminPath("/class-levels?active=1")),
        ok({ classLevels: [] as ClassLevelItem[] })
      ),
    ]).then(([ins, tch, bat, cls]) => {
      if (!alive) return;
      setInstruments((ins.data?.instruments ?? []).map((i) => ({ _id: i._id, name: i.name })));
      setTeachers(
        ((tch.data as Paginated<{ _id: string; name: string; status: string }>)?.items ?? [])
          .filter((t) => t.status === "active")
          .map((t) => ({ _id: t._id, name: t.name }))
      );
      setBatches(
        ((bat.data as Paginated<{ _id: string; name: string; status: string }>)?.items ?? [])
          .map((b) => ({ _id: b._id, name: b.name }))
      );
      setClassLevels((cls.data as { classLevels: ClassLevelItem[] })?.classLevels ?? []);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // Picking a class level pre-fills the total fee, default paid, and validity window.
  const onClass = (id: string | null) => {
    const c = classLevels.find((x) => x._id === id);
    setForm((f) => {
      if (!c) return { ...f, classLevelId: id };
      const start = f.validityStart || todayISO();
      return {
        ...f,
        classLevelId: id,
        feeRupees: String(Math.round(c.upcomingAmount / 100)),
        paidRupees: c.paidAmount > 0 ? String(Math.round(c.paidAmount / 100)) : f.paidRupees,
        validityStart: start,
        validityEnd: addDaysISO(start, c.days),
      };
    });
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Student name is required");
    if (!form.mobile.trim()) return toast.error("Mobile number is required");

    const toPaise = (r: string) => (r === "" ? undefined : Math.round(Number(r) * 100));
    const num = (n: string) => (n === "" ? undefined : Number(n));
    const validityDays =
      form.validityStart && form.validityEnd ? daysBetween(form.validityStart, form.validityEnd) : undefined;

    const body = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
      proposed: {
        classLevelId: form.classLevelId ?? undefined,
        teacherId: form.teacherId ?? undefined,
        batchId: form.batchId ?? undefined,
        instrumentId: form.instrumentId ?? undefined,
        gender: form.gender ?? undefined,
        mode: form.mode ?? undefined,
        sessionType: form.sessionType ?? undefined,
        joinStatus: form.joinStatus ?? undefined,
        category: form.category ?? undefined,
        validityStart: form.validityStart || undefined,
        validityEnd: form.validityEnd || undefined,
        validityDays,
        feeTotal: toPaise(form.feeRupees),
        paidAmount: toPaise(form.paidRupees),
        paidClasses: num(form.paidClasses),
        remarks: form.remarks.trim() || undefined,
      },
    };

    setSaving(true);
    try {
      await mockable(
        () => api.post<ApiResponse<{ request: { _id: string } }>>(adminPath("/requests"), body),
        ok({ request: { _id: `req_local_${Date.now()}` } })
      );
      toast.success(`${body.name} sent to New Requests for review`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Add Student"
      subtitle="Creates a request for review in New Requests, then approve to enrol"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Send to requests
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Full name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Input label="Mobile" required placeholder="98765 43210" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <Select label="Gender" placeholder="—" options={GENDER} value={form.gender} onChange={(v) => set("gender", v)} />
        </div>

        <Select
          label="Class level (auto-fills fee + validity)"
          placeholder={classLevels.length ? "Select a class" : "No class levels — add them under Operations → Class"}
          options={classLevels.map((c) => ({ value: c._id, label: `${c.name} · ₹${Math.round(c.upcomingAmount / 100)} · ${c.days}d` }))}
          value={form.classLevelId}
          onChange={onClass}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Instrument"
            placeholder="Select instrument"
            options={instruments.map((i) => ({ value: i._id, label: i.name }))}
            value={form.instrumentId}
            onChange={(v) => set("instrumentId", v)}
          />
          <Select
            label="Teacher (optional)"
            placeholder="Assign later"
            options={teachers.map((t) => ({ value: t._id, label: t.name }))}
            value={form.teacherId}
            onChange={(v) => set("teacherId", v)}
          />
        </div>
        <Select
          label="Batch (optional)"
          placeholder="Assign later"
          options={batches.map((b) => ({ value: b._id, label: b.name }))}
          value={form.batchId}
          onChange={(v) => set("batchId", v)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Mode" options={MODE} value={form.mode} onChange={(v) => set("mode", v)} />
          <Select label="Session type" options={SESSION} value={form.sessionType} onChange={(v) => set("sessionType", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Join status" options={JOIN_STATUS} value={form.joinStatus} onChange={(v) => set("joinStatus", v)} />
          <Select label="Category" options={CATEGORY} value={form.category} onChange={(v) => set("category", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Validity start" type="date" value={form.validityStart} onChange={(e) => set("validityStart", e.target.value)} />
          <Input label="Validity end" type="date" value={form.validityEnd} onChange={(e) => set("validityEnd", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Total fee (₹)" type="number" min={0} value={form.feeRupees} onChange={(e) => set("feeRupees", e.target.value)} />
          <Input label="Paid now (₹)" type="number" min={0} value={form.paidRupees} onChange={(e) => set("paidRupees", e.target.value)} />
          <Input label="Paid classes" type="number" min={0} value={form.paidClasses} onChange={(e) => set("paidClasses", e.target.value)} />
        </div>

        <RemarksField
          value={form.remarks}
          onChange={(v) => set("remarks", v)}
          placeholder="Internal notes about this student…"
        />
      </div>
    </Modal>
  );
}
