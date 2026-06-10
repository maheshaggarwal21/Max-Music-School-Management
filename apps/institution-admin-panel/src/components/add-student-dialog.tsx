"use client";
// Admin "Add Student" — directly enrols a student into THIS institution,
// bypassing the two-step enrollment-request flow. POSTs to /:slug/admin/students.
// Instrument / teacher / batch lists are fetched live for the institution.
// Amounts are entered in rupees and sent as paise (the stored unit).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Modal, Select } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_BATCHES, MOCK_INSTRUMENTS, MOCK_TEACHERS, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, Paginated } from "@/lib/types";

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
  instrumentId: null as string | null,
  teacherId: null as string | null,
  batchId: null as string | null,
  mode: "online" as string | null,
  sessionType: "all" as string | null,
  joinStatus: "trial" as string | null,
  category: "regular" as string | null,
  validityStart: "",
  validityEnd: "",
  paidRupees: "",
  upcomingRupees: "",
  paidClasses: "",
};

type Named = { _id: string; name: string };

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
    ]).then(([ins, tch, bat]) => {
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
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Student name is required");
    if (!form.mobile.trim()) return toast.error("Mobile number is required");

    const toPaise = (r: string) => (r === "" ? undefined : Math.round(Number(r) * 100));
    const num = (n: string) => (n === "" ? undefined : Number(n));

    const body = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
      gender: form.gender ?? undefined,
      instrumentId: form.instrumentId ?? undefined,
      teacherId: form.teacherId ?? undefined,
      batchId: form.batchId ?? undefined,
      mode: form.mode ?? undefined,
      sessionType: form.sessionType ?? undefined,
      joinStatus: form.joinStatus ?? undefined,
      category: form.category ?? undefined,
      validityStart: form.validityStart || undefined,
      validityEnd: form.validityEnd || undefined,
      paidAmount: toPaise(form.paidRupees),
      upcomingAmount: toPaise(form.upcomingRupees),
      paidClasses: num(form.paidClasses),
    };

    setSaving(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ student: { _id: string; displayId: string; name: string }; tempPassword: string }>>(
            adminPath("/students"),
            body
          ),
        ok({ student: { _id: `stu_local_${Date.now()}`, displayId: "—", name: body.name }, tempPassword: "mock-temp" })
      );
      const tp = res.data?.tempPassword;
      toast.success(`${body.name} enrolled` + (tp ? ` · temp password: ${tp}` : ""));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Add Student"
      subtitle="Enrol a student directly (skips the enrollment request)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Add student
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
          <Input label="Paid (₹)" type="number" min={0} value={form.paidRupees} onChange={(e) => set("paidRupees", e.target.value)} />
          <Input label="Upcoming (₹)" type="number" min={0} value={form.upcomingRupees} onChange={(e) => set("upcomingRupees", e.target.value)} />
          <Input label="Paid classes" type="number" min={0} value={form.paidClasses} onChange={(e) => set("paidClasses", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
