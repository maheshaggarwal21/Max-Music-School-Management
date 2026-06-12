"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import {
  Avatar, BlurFade, Button, SearchBar, Select, StatusBadge,
} from "@maxmusic/ui";
import { Table, type DataTableColumn } from "@/components/table";
import { formatCurrency, formatDate, formatPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_STUDENTS, MOCK_TEACHERS, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, JoinStatus, Paginated, StudentRow } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { StudentEditDialog } from "@/components/student-edit-dialog";
import { AddStudentDialog } from "@/components/add-student-dialog";

const JOIN_STATUS_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "active_soon", label: "Active Soon" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [teachers, setTeachers] = useState<{ _id: string; name: string }[]>([]);

  // In live mode search/joinStatus/teacherId become query params (CONTRACTS);
  // in mock mode we filter the full list client-side.
  const load = useCallback(() => {
    return mockable(
      () => api.get<ApiResponse<Paginated<StudentRow>>>(adminPath("/students?page=1&limit=100")),
      ok(paginate(MOCK_STUDENTS))
    ).then((r) => setStudents(r.data?.items ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Real teacher list for the filter dropdown (and shared shape with the add form).
  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<Paginated<{ _id: string; name: string; status: string }>>>(adminPath("/teachers?page=1&limit=100")),
      ok(paginate(MOCK_TEACHERS))
    ).then((r) => {
      if (cancelled) return;
      const items = (r.data as Paginated<{ _id: string; name: string; status: string }>)?.items ?? [];
      setTeachers(items.map((t) => ({ _id: t._id, name: t.name })));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      if (statusFilter && s.joinStatus !== (statusFilter as JoinStatus)) return false;
      if (teacherFilter && s.teacher?._id !== teacherFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.displayId.toLowerCase().includes(q) ||
        s.mobile.includes(q) ||
        (s.instrument ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, search, statusFilter, teacherFilter]);

  const columns: DataTableColumn<StudentRow>[] = [
    {
      key: "name",
      label: "Student",
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={s.name} size="sm" />
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{s.displayId}</p>
          </div>
        </div>
      ),
    },
    { key: "mobile", label: "Mobile", render: (s) => <span className="text-xs">{formatPhone(s.mobile)}</span> },
    { key: "instrument", label: "Instrument", render: (s) => s.instrument ?? "—" },
    {
      key: "schedule",
      label: "Schedule",
      render: (s) =>
        s.schedule.days ? (
          <span className="text-xs">
            {s.schedule.days}
            <span className="text-muted-foreground"> · {s.schedule.time}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        ),
    },
    { key: "joinStatus", label: "Status", render: (s) => <StatusBadge status={s.joinStatus} /> },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (s) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={s.paymentStatus} />
          {s.remainingAmount > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-500">
              {formatCurrency(s.remainingAmount)} left
            </span>
          )}
        </div>
      ),
    },
    {
      key: "validityEnd",
      label: "Validity",
      render: (s) => <span className="text-xs">{s.validityEnd ? formatDate(s.validityEnd) : "—"}</span>,
    },
    { key: "teacher", label: "Teacher", render: (s) => s.teacher?.name ?? <span className="text-xs text-muted-foreground">—</span> },
    {
      key: "actions",
      label: "Actions",
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Edit ${s.name}`}
            onClick={() => setEditing(s)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Students"
      subtitle={
        students
          ? `${students.length} enrolled · ${students.filter((s) => s.joinStatus === "active").length} active`
          : "Manage enrolled students"
      }
      actions={
        <Button variant="brand" className="group rounded-full" onClick={() => setAddOpen(true)}>
          Add Student
          <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        </Button>
      }
    >
      {/* Search + filters */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-end gap-3">
          <SearchBar
            className="w-full sm:w-72"
            placeholder="Search name, ID, mobile, instrument…"
            onSearch={setSearch}
          />
          <div className="w-44">
            <Select
              placeholder="All statuses"
              options={JOIN_STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <div className="w-48">
            <Select
              placeholder="All teachers"
              searchable
              options={teachers.map((t) => ({ value: t._id, label: t.name }))}
              value={teacherFilter}
              onChange={setTeacherFilter}
            />
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {!students ? (
          <TableSkeleton rows={8} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter || teacherFilter ? "No matching students" : "No students yet"}
            hint={
              search || statusFilter || teacherFilter
                ? "Try clearing the search or filters."
                : "Approve an enrollment request to create your first student."
            }
          />
        ) : (
          <Table
            columns={columns}
            data={visible}
            onRowClick={(row) => setEditing(row)}
          />
        )}
      </BlurFade>

      {/* Add Student → big form, direct enrollment (bypasses request flow) */}
      <AddStudentDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      {/* Pencil → THE big edit form with the live activity rail */}
      <StudentEditDialog
        studentId={editing?._id ?? null}
        studentName={editing?.name}
        onClose={() => setEditing(null)}
        onUpdated={(u) =>
          setStudents((prev) =>
            (prev ?? []).map((s) =>
              s._id === u._id
                ? {
                    ...s,
                    instrument: u.instrument,
                    classType: u.classType,
                    schedule: u.schedule,
                    joinStatus: u.joinStatus,
                    validityEnd: u.validityEnd,
                    teacher: u.teacher,
                  }
                : s
            )
          )
        }
      />
    </PageShell>
  );
}
