"use client";
// Operator god-mode "Add Student" — enrols a student directly into any chosen
// institution via POST /api/operator/students. Institution-scoped instrument +
// teacher lists are fetched live once a school is picked. Amounts are entered in
// rupees and sent as paise (the stored unit).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Modal, Select } from "@maxmusic/ui";
import { api, mockable } from "@/lib/api";
import type {
  ApiResponse,
  OperatorStudentRow,
  OperatorTeacherRow,
  Paginated,
} from "@/lib/types";
import type { InstitutionOption } from "@/lib/use-institution-options";

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
  institutionId: "" as string,
  name: "",
  mobile: "",
  email: "",
  gender: null as string | null,
  instrumentId: null as string | null,
  teacherId: null as string | null,
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

export function AddStudentModal({
  open,
  onClose,
  institutionOptions,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  institutionOptions: InstitutionOption[];
  onCreated: (row: OperatorStudentRow) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [instruments, setInstruments] = useState<{ _id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ _id: string; name: string }[]>([]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Reset whenever the modal re-opens.
  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setInstruments([]);
      setTeachers([]);
    }
  }, [open]);

  // Load the chosen institution's instruments + active teachers.
  useEffect(() => {
    const id = form.institutionId;
    if (!id) {
      setInstruments([]);
      setTeachers([]);
      return;
    }
    let alive = true;
    Promise.all([
      mockable(
        () =>
          api.get<ApiResponse<{ instruments: { _id: string; name: string; isActive: boolean }[] }>>(
            `/api/operator/settings/instruments?institutionId=${id}`
          ),
        { success: true, message: "OK", data: { instruments: [] } }
      ),
      mockable(
        () =>
          api.get<ApiResponse<Paginated<OperatorTeacherRow>>>(
            `/api/operator/teachers?institutionId=${id}&limit=100`
          ),
        { success: true, message: "OK", data: { items: [], pagination: { page: 1, limit: 100, total: 0, pages: 1 } } }
      ),
    ]).then(([ins, tch]) => {
      if (!alive) return;
      setInstruments((ins.data?.instruments ?? []).filter((i) => i.isActive !== false));
      setTeachers(
        (tch.data?.items ?? [])
          .filter((t) => t.status === "active")
          .map((t) => ({ _id: t._id, name: t.name }))
      );
    });
    return () => {
      alive = false;
    };
  }, [form.institutionId]);

  const submit = async () => {
    if (!form.institutionId) return toast.error("Select an institution");
    if (!form.name.trim()) return toast.error("Student name is required");
    if (!form.mobile.trim()) return toast.error("Mobile number is required");

    const toPaise = (r: string) => (r === "" ? undefined : Math.round(Number(r) * 100));
    const num = (n: string) => (n === "" ? undefined : Number(n));

    const body = {
      institutionId: form.institutionId,
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
      gender: form.gender ?? undefined,
      instrumentId: form.instrumentId ?? undefined,
      teacherId: form.teacherId ?? undefined,
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
      const instName =
        institutionOptions.find((o) => o.value === form.institutionId)?.label ?? "Institution";
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ student: OperatorStudentRow; tempPassword: string }>>(
            "/api/operator/students",
            body
          ),
        {
          success: true,
          message: "Student created",
          data: {
            student: {
              _id: `stu_local_${Date.now()}`,
              displayId: "—",
              name: body.name,
              mobile: body.mobile,
              email: body.email ?? null,
              institution: { _id: form.institutionId, name: instName, slug: "" },
              teacher: form.teacherId ? { _id: form.teacherId, name: teachers.find((t) => t._id === form.teacherId)?.name ?? "" } : null,
              batch: null,
              instrument: instruments.find((i) => i._id === form.instrumentId)?.name ?? null,
              joinStatus: (form.joinStatus ?? "trial") as OperatorStudentRow["joinStatus"],
              paidAmount: body.paidAmount ?? 0,
              upcomingAmount: body.upcomingAmount ?? 0,
              validityEnd: body.validityEnd ?? null,
              createdAt: new Date().toISOString(),
            },
            tempPassword: "mock-temp",
          },
        }
      );
      if (res.data?.student) {
        onCreated(res.data.student);
        toast.success(
          `${res.data.student.name} enrolled` +
            (res.data.tempPassword ? ` · temp password: ${res.data.tempPassword}` : "")
        );
        onClose();
      }
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
      subtitle="Enrol a student directly into an institution (operator)"
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
        <Select
          label="Institution"
          required
          searchable
          placeholder="Select institution"
          options={institutionOptions}
          value={form.institutionId || null}
          onChange={(v) => set("institutionId", v ?? "")}
        />

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
            placeholder={form.institutionId ? "Select instrument" : "Pick institution first"}
            options={instruments.map((i) => ({ value: i._id, label: i.name }))}
            value={form.instrumentId}
            onChange={(v) => set("instrumentId", v)}
            disabled={!form.institutionId}
          />
          <Select
            label="Teacher (optional)"
            placeholder={form.institutionId ? "Assign later" : "Pick institution first"}
            options={teachers.map((t) => ({ value: t._id, label: t.name }))}
            value={form.teacherId}
            onChange={(v) => set("teacherId", v)}
            disabled={!form.institutionId}
          />
        </div>

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
