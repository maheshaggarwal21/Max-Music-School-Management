"use client";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar, BlurFade, Button, Input, Modal, SearchBar, Select,
  StatusBadge, cn,
} from "@maxmusic/ui";
import { Table, type DataTableColumn } from "@/components/table";
import { formatCurrency, formatPhone, isValidEmail, isValidPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_TEACHERS, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, Paginated, TeacherRow } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";

// PBAC: institution admins manage staff teachers, but ONLY the operator can
// grant 'admin' panelAccess — so this form deliberately has NO such option.

interface TeacherForm {
  name: string;
  mobile: string;
  altMobile: string;
  email: string;
  gender: string | null;
  salaryRupees: string; // input in ₹, sent in paise
  status: "active" | "inactive";
}

const EMPTY_FORM: TeacherForm = {
  name: "", mobile: "", altMobile: "", email: "", gender: null,
  salaryRupees: "", status: "active",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<Paginated<TeacherRow>>>(adminPath("/teachers?page=1&limit=100")),
      ok(paginate(MOCK_TEACHERS))
    ).then((r) => !cancelled && setTeachers(r.data?.items ?? []));
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers ?? [];
    return (teachers ?? []).filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.mobile.includes(q) ||
        t.displayId.toLowerCase().includes(q)
    );
  }, [teachers, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (t: TeacherRow) => {
    setEditing(t);
    setForm({
      name: t.name, mobile: t.mobile, altMobile: "", email: t.email,
      gender: null, salaryRupees: "", status: t.status,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!isValidPhone(form.mobile)) return toast.error("Enter a valid mobile number");
    if (!isValidEmail(form.email)) return toast.error("Enter a valid email");
    setSaving(true);
    try {
      const salaryAmount = form.salaryRupees
        ? Math.round(Number(form.salaryRupees) * 100)
        : undefined;
      if (editing) {
        await mockable(
          () =>
            api.patch<ApiResponse>(adminPath(`/teachers/${editing._id}`), {
              name: form.name.trim(), mobile: form.mobile, email: form.email,
              altMobile: form.altMobile || undefined,
              gender: form.gender ?? undefined,
              salaryAmount, status: form.status,
            }),
          ok(null),
          500
        );
        setTeachers((prev) =>
          (prev ?? []).map((t) =>
            t._id === editing._id
              ? { ...t, name: form.name.trim(), mobile: form.mobile, email: form.email, status: form.status }
              : t
          )
        );
        toast.success(`${form.name.trim()} updated`);
      } else {
        await mockable(
          () =>
            api.post<ApiResponse>(adminPath("/teachers"), {
              name: form.name.trim(), mobile: form.mobile, email: form.email,
              altMobile: form.altMobile || undefined,
              gender: form.gender ?? undefined,
              salaryAmount,
            }),
          ok(null),
          500
        );
        setTeachers((prev) => [
          {
            _id: `tch_local_${Date.now()}`,
            displayId: `TCH-${`${(prev?.length ?? 0) + 1}`.padStart(3, "0")}`,
            name: form.name.trim(), mobile: form.mobile, email: form.email,
            role: "staff", panelAccess: ["teacher"],
            activeBatches: 0, performance: null, kpiPercent: null, status: "active",
          },
          ...(prev ?? []),
        ]);
        toast.success(`${form.name.trim()} added to faculty`);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<TeacherRow>[] = [
    {
      key: "name",
      label: "Teacher",
      render: (t) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={t.name} size="sm" />
          <div>
            <p className="font-medium">
              {t.name}
              {t.role === "owner" && (
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
                  Owner
                </span>
              )}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{t.displayId}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (t) => (
        <div className="text-xs">
          <p>{formatPhone(t.mobile)}</p>
          <p className="text-muted-foreground">{t.email}</p>
        </div>
      ),
    },
    {
      key: "panelAccess",
      label: "Panel Access",
      render: (t) => (
        <div className="flex gap-1">
          {t.panelAccess.map((p) => (
            <span
              key={p}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                p === "admin" ? "bg-violet-400/10 text-violet-500" : "bg-brand/10 text-brand"
              )}
            >
              {p}
            </span>
          ))}
        </div>
      ),
    },
    { key: "activeBatches", label: "Batches", render: (t) => <span className="font-medium">{t.activeBatches}</span> },
    {
      key: "kpiPercent",
      label: "KPI",
      render: (t) =>
        t.kpiPercent !== null ? (
          <span className={cn("text-xs font-semibold", t.kpiPercent >= 80 ? "text-emerald-500" : "text-amber-500")}>
            {t.kpiPercent}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "status", label: "Status", render: (t) => <StatusBadge status={t.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (t) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => openEdit(t)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Teachers"
      subtitle={
        teachers
          ? `${teachers.filter((t) => t.status === "active").length} active faculty members`
          : "Manage your faculty"
      }
      actions={
        <Button variant="brand" className="group rounded-full" onClick={openCreate}>
          Add Teacher
          <Plus className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </Button>
      }
    >
      <BlurFade delay={0.1}>
        <SearchBar
          className="w-full sm:w-72"
          placeholder="Search name, email, mobile…"
          onSearch={setSearch}
        />
      </BlurFade>

      <BlurFade delay={0.2}>
        {!teachers ? (
          <TableSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={search ? "No matching teachers" : "No teachers yet"}
            hint={search ? "Try a different search." : "Add your first faculty member to start creating batches."}
          />
        ) : (
          <Table columns={columns} data={visible} />
        )}
      </BlurFade>

      {/* Create / edit modal — NO 'admin' panel-access option (operator-only) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add Teacher"}
        subtitle={
          editing
            ? "Update contact details, salary or status"
            : "New staff teachers get teacher-panel access only"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Add Teacher"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mobile"
              required
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            />
            <Input
              label="Alternate mobile"
              value={form.altMobile}
              onChange={(e) => setForm({ ...form, altMobile: e.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Gender"
              placeholder="Optional"
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other" },
              ]}
              value={form.gender}
              onChange={(v) => setForm({ ...form, gender: v })}
            />
            <Input
              label="Monthly salary (₹)"
              type="number"
              min={0}
              placeholder="e.g. 25000"
              value={form.salaryRupees}
              onChange={(e) => setForm({ ...form, salaryRupees: e.target.value })}
            />
          </div>
          {form.salaryRupees && (
            <p className="text-xs text-muted-foreground">
              Will be recorded as {formatCurrency(Math.round(Number(form.salaryRupees) * 100) || 0)} per month.
            </p>
          )}
          {editing && (
            <Select
              label="Status"
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: (v as "active" | "inactive") ?? "active" })}
            />
          )}
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            Panel access: <span className="font-semibold text-brand">teacher</span>. Admin-panel
            access can only be granted by the platform — not from here.
          </p>
        </div>
      </Modal>
    </PageShell>
  );
}
