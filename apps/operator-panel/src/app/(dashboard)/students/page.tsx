"use client";
// P5-05 — Cross-institution students: institution tag column, joinStatus
// badges, filters (institution, joinStatus) + search, server-style pagination.

import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  Button,
  SearchBar,
  Select,
  StatusBadge,
} from "@maxmusic/ui";
import { AddStudentModal } from "@/components/add-student-modal";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatCurrency, formatDate, formatPhone } from "@maxmusic/utils";
import { EmptyState } from "@/components/empty-state";
import { StudentEditModal } from "@/components/student-edit-modal";
import { PageHeader } from "@/components/page-header";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { TableSkeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { mockStudentList } from "@/lib/mocks";
import { useInstitutionOptions } from "@/lib/use-institution-options";
import type { ApiResponse, OperatorStudentRow, Paginated } from "@/lib/types";

const LIMIT = 10;

const JOIN_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "trial", label: "Trial" },
  { value: "active_soon", label: "Active Soon" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function StudentsPage() {
  const [rows, setRows] = useState<OperatorStudentRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);

  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<string | null>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<OperatorStudentRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const institutionOptions = useInstitutionOptions();

  const handleCreated = (row: OperatorStudentRow) => {
    setRows((prev) => [row, ...prev]);
    setPagination((p) => ({ ...p, total: p.total + 1 }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        search,
        institutionId: institutionId ?? "",
        joinStatus: joinStatus ?? "all",
      });
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<OperatorStudentRow>>>(
            `/api/operator/students?${params}`
          ),
        mockStudentList({
          page,
          limit: LIMIT,
          search,
          institutionId: institutionId ?? undefined,
          joinStatus: joinStatus ?? "all",
        })
      );
      if (res.data) {
        setRows(res.data.items);
        setPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [page, search, institutionId, joinStatus]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns: DataTableColumn<OperatorStudentRow>[] = [
    {
      key: "displayId",
      label: "ID",
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.displayId}</span>,
    },
    {
      key: "name",
      label: "Student",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{formatPhone(r.mobile)}</p>
        </div>
      ),
    },
    {
      key: "institution",
      label: "Institution",
      render: (r) => <Tag>{r.institution.name}</Tag>,
    },
    {
      key: "instrument",
      label: "Instrument",
      render: (r) =>
        r.instrument ? (
          <span>{r.instrument}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "teacher",
      label: "Teacher",
      render: (r) =>
        r.teacher ? (
          <span className="text-muted-foreground">{r.teacher.name}</span>
        ) : (
          <Tag tone="amber">Setting phase</Tag>
        ),
    },
    {
      key: "joinStatus",
      label: "Status",
      render: (r) => <StatusBadge status={r.joinStatus} />,
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (r) => <span className="tabular-nums">{formatCurrency(r.paidAmount)}</span>,
    },
    {
      key: "validityEnd",
      label: "Validity",
      render: (r) => (
        <span className="text-muted-foreground">
          {r.validityEnd ? formatDate(r.validityEnd) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <RowActionsMenu
          label={`Actions for ${r.name}`}
          actions={[
            { key: "edit", label: "Edit details", icon: Pencil, onSelect: () => setEditing(r) },
          ]}
        />
      ),
    },
  ];

  /** Optimistic row update after the edit modal saves (it owns the PATCH). */
  const onStudentSaved = (rowPatch: Partial<OperatorStudentRow>) => {
    if (!editing) return;
    setRows((prev) => prev.map((x) => (x._id === editing._id ? { ...x, ...rowPatch } : x)));
  };

  const noResults = !loading && rows.length === 0;

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Students"
        subtitle={`${pagination.total} students across all institutions`}
        actions={
          <Button variant="brand" className="group rounded-full" onClick={() => setAddOpen(true)}>
            Add Student
            <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        }
      />

      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            placeholder="Search name, mobile or ID…"
            className="w-72"
          />
          <Select
            options={[{ value: "", label: "All institutions" }, ...institutionOptions]}
            value={institutionId ?? ""}
            onChange={(v) => {
              setInstitutionId(v || null);
              setPage(1);
            }}
            searchable
            className="w-64"
          />
          <Select
            options={JOIN_STATUS_OPTIONS}
            value={joinStatus}
            onChange={(v) => {
              setJoinStatus(v);
              setPage(1);
            }}
            className="w-44"
          />
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {initial ? (
          <TableSkeleton rows={8} cols={9} />
        ) : noResults ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description="No students match the current filters. Students are enrolled inside each institution's admin panel — this view is read-only god-mode."
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            pagination={{ ...pagination, onPageChange: setPage }}
          />
        )}
      </BlurFade>

      {/* Edit modal — full admin-parity form left, live activity rail right */}
      {editing && (
        <StudentEditModal
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={onStudentSaved}
        />
      )}

      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        institutionOptions={institutionOptions}
        onCreated={handleCreated}
      />
    </div>
  );
}
