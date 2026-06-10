"use client";
import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  Avatar, BlurFade, SearchBar, Select, StatusBadge,
} from "@maxmusic/ui";
import { Table, type DataTableColumn } from "@/components/table";
import { formatDate, formatPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_STUDENTS, MOCK_TEACHERS, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, JoinStatus, Paginated, StudentRow } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { StudentDetailModal } from "@/components/student-detail-modal";

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
  const [selected, setSelected] = useState<StudentRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    // In live mode search/joinStatus/teacherId become query params (CONTRACTS);
    // in mock mode we filter the full list client-side.
    mockable(
      () => api.get<ApiResponse<Paginated<StudentRow>>>(adminPath("/students?page=1&limit=100")),
      ok(paginate(MOCK_STUDENTS))
    ).then((r) => !cancelled && setStudents(r.data?.items ?? []));
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
      key: "validityEnd",
      label: "Validity",
      render: (s) => <span className="text-xs">{s.validityEnd ? formatDate(s.validityEnd) : "—"}</span>,
    },
    { key: "teacher", label: "Teacher", render: (s) => s.teacher?.name ?? <span className="text-xs text-muted-foreground">—</span> },
  ];

  return (
    <PageShell
      title="Students"
      subtitle={
        students
          ? `${students.length} enrolled · ${students.filter((s) => s.joinStatus === "active").length} active`
          : "Manage enrolled students"
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
              options={MOCK_TEACHERS.map((t) => ({ value: t._id, label: t.name }))}
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
            onRowClick={(row) => setSelected(row)}
          />
        )}
      </BlurFade>

      {/* THE student detail popup */}
      <StudentDetailModal
        studentId={selected?._id ?? null}
        studentName={selected?.name}
        onClose={() => setSelected(null)}
      />
    </PageShell>
  );
}
