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
import {
  EntityEditModal,
  type EditSection,
} from "@/components/entity-edit-modal";
import { PageHeader } from "@/components/page-header";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { TableSkeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import {
  getMockStudentPaidClasses,
  mockStudentList,
  mockStudentPatched,
  setMockStudentPaidClasses,
} from "@/lib/mocks";
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

/** Edit-modal field config — institution stays a READ-ONLY chip. */
const STUDENT_EDIT_SECTIONS: EditSection[] = [
  {
    title: "Profile",
    fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "mobile", label: "Mobile", type: "phone", required: true, placeholder: "98765 43210" },
    ],
  },
  {
    title: "Course & Fees",
    fields: [
      {
        key: "joinStatus",
        label: "Join status",
        type: "select",
        required: true,
        options: JOIN_STATUS_OPTIONS.filter((o) => o.value !== "all"),
      },
      { key: "validityEnd", label: "Validity end", type: "date" },
      { key: "paidAmount", label: "Paid amount (₹)", type: "currency" },
      { key: "upcomingAmount", label: "Upcoming amount (₹)", type: "currency" },
      { key: "paidClasses", label: "Paid classes", type: "number" },
    ],
  },
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

  /** PATCH (mockable) + optimistic row update; the modal records the activity stream. */
  const saveStudent = async (row: OperatorStudentRow, patch: Record<string, unknown>) => {
    const rowPatch: Partial<OperatorStudentRow> = {
      ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
      ...(patch.mobile !== undefined ? { mobile: String(patch.mobile) } : {}),
      ...(patch.joinStatus !== undefined
        ? { joinStatus: patch.joinStatus as OperatorStudentRow["joinStatus"] }
        : {}),
      ...(patch.paidAmount !== undefined ? { paidAmount: Number(patch.paidAmount ?? 0) } : {}),
      ...(patch.upcomingAmount !== undefined
        ? { upcomingAmount: Number(patch.upcomingAmount ?? 0) }
        : {}),
      ...(patch.validityEnd !== undefined
        ? { validityEnd: patch.validityEnd == null ? null : String(patch.validityEnd) }
        : {}),
    };
    await mockable(
      () =>
        // CONTRACT GAP: flag for Dev A — CONTRACTS.md defines only
        // GET /api/operator/students; PATCH /api/operator/students/:id
        // (operator god-mode edit, audited per-diff) is missing.
        api.patch<ApiResponse<{ student: OperatorStudentRow }>>(
          `/api/operator/students/${row._id}`,
          patch
        ),
      mockStudentPatched(row._id, rowPatch)
    );
    // paidClasses is not on OperatorStudentRow (see CONTRACT GAP in mocks.ts)
    if (patch.paidClasses !== undefined)
      setMockStudentPaidClasses(row._id, Number(patch.paidClasses ?? 0));
    setRows((prev) => prev.map((x) => (x._id === row._id ? { ...x, ...rowPatch } : x)));
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

      {/* Edit modal — form left, live activity node-graph right */}
      {editing && (
        <EntityEditModal
          open
          onClose={() => setEditing(null)}
          title="Edit Student"
          subtitle={`${editing.displayId} · ${editing.institution.name}`}
          entityId={editing._id}
          sections={STUDENT_EDIT_SECTIONS}
          initialValues={{
            name: editing.name,
            mobile: editing.mobile,
            joinStatus: editing.joinStatus,
            validityEnd: editing.validityEnd,
            paidAmount: editing.paidAmount,
            upcomingAmount: editing.upcomingAmount,
            paidClasses: getMockStudentPaidClasses(editing._id),
          }}
          readOnly={{
            title: "Institution",
            content: (
              <>
                <Tag>{editing.institution.name}</Tag>
                {editing.teacher && <Tag tone="neutral">{editing.teacher.name}</Tag>}
                {editing.instrument && <Tag tone="neutral">{editing.instrument}</Tag>}
              </>
            ),
            helper: "Enrollment, batch and teacher are managed from the institution's admin panel.",
          }}
          activityPath={`/api/operator/changes?entityType=Student&entityId=${editing._id}&limit=50`}
          onSave={(patch) => saveStudent(editing, patch)}
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
