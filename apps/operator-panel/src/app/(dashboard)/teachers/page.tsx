"use client";
// P5-06 — Cross-institution teachers: institution tag, panelAccess badges,
// salary/rent amount (formatCurrency), filters (institution, employmentType).

import { useCallback, useEffect, useState } from "react";
import { Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  SearchBar,
  Select,
  StatusBadge,
} from "@maxmusic/ui";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatCurrency, formatPhone } from "@maxmusic/utils";
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
  mockTeacherList,
  mockTeacherPatched,
  teacherPanelAccess,
} from "@/lib/mocks";
import { useInstitutionOptions } from "@/lib/use-institution-options";
import type { ApiResponse, OperatorTeacherRow, Paginated } from "@/lib/types";

const LIMIT = 10;

const EMPLOYMENT_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "salary", label: "Salary (managed)" },
  { value: "rent", label: "Rent (autonomous)" },
];

/** Edit-modal field config — institution + panelAccess stay READ-ONLY chips. */
const TEACHER_EDIT_SECTIONS: EditSection[] = [
  {
    title: "Profile",
    fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "mobile", label: "Mobile", type: "phone", required: true, placeholder: "98765 43210" },
      { key: "altMobile", label: "Alt mobile", type: "phone", placeholder: "Backup number" },
      {
        key: "gender",
        label: "Gender",
        type: "select",
        options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ],
      },
      { key: "dob", label: "Date of birth", type: "date" },
    ],
  },
  {
    title: "Status & Billing",
    fields: [
      { key: "salaryAmount", label: "Salary (₹ / month)", type: "currency" },
      {
        key: "razorpayPaymentLink",
        label: "Payment link",
        type: "text",
        placeholder: "https://rzp.io/l/…",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
    ],
  },
];

export default function TeachersPage() {
  const [rows, setRows] = useState<OperatorTeacherRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);

  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [employmentType, setEmploymentType] = useState<string | null>("all");
  const [page, setPage] = useState(1);
  const institutionOptions = useInstitutionOptions();
  const [editing, setEditing] = useState<OperatorTeacherRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        search,
        institutionId: institutionId ?? "",
        employmentType: employmentType === "all" ? "" : employmentType ?? "",
      });
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<OperatorTeacherRow>>>(
            `/api/operator/teachers?${params}`
          ),
        mockTeacherList({
          page,
          limit: LIMIT,
          search,
          institutionId: institutionId ?? undefined,
          employmentType: employmentType ?? "all",
        })
      );
      if (res.data) {
        setRows(res.data.items);
        setPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load teachers");
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [page, search, institutionId, employmentType]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns: DataTableColumn<OperatorTeacherRow>[] = [
    {
      key: "displayId",
      label: "ID",
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.displayId}</span>,
    },
    {
      key: "name",
      label: "Teacher",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {r.name}
            {r.role === "owner" && (
              <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wider text-brand">
                owner
              </span>
            )}
          </p>
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
      key: "panelAccess",
      label: "Panel Access",
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {teacherPanelAccess(r).map((p) => (
            <Tag key={p} tone={p === "admin" ? "violet" : "brand"}>
              {p}
            </Tag>
          ))}
        </span>
      ),
    },
    {
      key: "employmentType",
      label: "Billing",
      render: (r) => (
        <Tag tone={r.employmentType === "rent" ? "violet" : "neutral"}>
          {r.employmentType === "rent" ? "pays rent" : "on salary"}
        </Tag>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (r) => (
        <span className="tabular-nums">
          {r.amount != null ? `${formatCurrency(r.amount)}/mo` : "—"}
        </span>
      ),
    },
    {
      key: "activeBatches",
      label: "Batches",
      render: (r) => <span className="tabular-nums">{r.activeBatches}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status} />,
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
  const saveTeacher = async (row: OperatorTeacherRow, patch: Record<string, unknown>) => {
    const rowPatch: Partial<OperatorTeacherRow> = {
      ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
      ...(patch.mobile !== undefined ? { mobile: String(patch.mobile) } : {}),
      ...(patch.altMobile !== undefined
        ? { altMobile: patch.altMobile ? String(patch.altMobile) : null }
        : {}),
      ...(patch.gender !== undefined
        ? { gender: (patch.gender || null) as OperatorTeacherRow["gender"] }
        : {}),
      ...(patch.dob !== undefined ? { dob: patch.dob ? String(patch.dob) : null } : {}),
      ...(patch.razorpayPaymentLink !== undefined
        ? { razorpayPaymentLink: patch.razorpayPaymentLink ? String(patch.razorpayPaymentLink) : null }
        : {}),
      // form key salaryAmount (CONTRACTS field name) ↔ row key amount
      ...(patch.salaryAmount !== undefined
        ? { amount: patch.salaryAmount == null ? null : Number(patch.salaryAmount) }
        : {}),
      ...(patch.status !== undefined
        ? { status: patch.status as OperatorTeacherRow["status"] }
        : {}),
    };
    await mockable(
      () =>
        // CONTRACT GAP: flag for Dev A — CONTRACTS.md defines only
        // GET /api/operator/teachers; PATCH /api/operator/teachers/:id
        // (operator god-mode edit, audited per-diff) is missing.
        api.patch<ApiResponse<{ teacher: OperatorTeacherRow }>>(
          `/api/operator/teachers/${row._id}`,
          patch
        ),
      mockTeacherPatched(row._id, rowPatch)
    );
    setRows((prev) => prev.map((x) => (x._id === row._id ? { ...x, ...rowPatch } : x)));
  };

  const noResults = !loading && rows.length === 0;

  return (
    <div className="relative flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Teachers"
        subtitle={`${pagination.total} teachers across all institutions`}
      />

      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            placeholder="Search name or mobile…"
            className="w-full sm:w-72"
          />
          <Select
            options={[{ value: "", label: "All institutions" }, ...institutionOptions]}
            value={institutionId ?? ""}
            onChange={(v) => {
              setInstitutionId(v || null);
              setPage(1);
            }}
            searchable
            className="w-full sm:w-64"
          />
          <Select
            options={EMPLOYMENT_OPTIONS}
            value={employmentType}
            onChange={(v) => {
              setEmploymentType(v);
              setPage(1);
            }}
            className="w-full sm:w-48"
          />
        </div>
      </BlurFade>

      <BlurFade delay={0.2}>
        {initial ? (
          <TableSkeleton rows={8} cols={9} />
        ) : noResults ? (
          <EmptyState
            icon={Users}
            title="No teachers found"
            description="No teachers match the current filters. Teachers are managed inside each institution's admin panel."
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
          title="Edit Teacher"
          subtitle={`${editing.displayId} · ${editing.institution.name}`}
          entityId={editing._id}
          sections={TEACHER_EDIT_SECTIONS}
          initialValues={{
            name: editing.name,
            mobile: editing.mobile,
            altMobile: editing.altMobile,
            gender: editing.gender,
            dob: editing.dob,
            razorpayPaymentLink: editing.razorpayPaymentLink,
            salaryAmount: editing.amount,
            status: editing.status,
          }}
          readOnly={{
            title: "Institution & Panel Access",
            content: (
              <>
                <Tag>{editing.institution.name}</Tag>
                {teacherPanelAccess(editing).map((p) => (
                  <Tag key={p} tone={p === "admin" ? "violet" : "brand"}>
                    {p}
                  </Tag>
                ))}
              </>
            ),
            helper: "Access is managed from the institution page.",
          }}
          activityPath={`/api/operator/changes?entityType=Teacher&entityId=${editing._id}&limit=50`}
          onSave={(patch) => saveTeacher(editing, patch)}
        />
      )}
    </div>
  );
}
