"use client";
// P5-04 — Institutions list: search + mode/status filters, Add Institution
// modal (name → auto slug preview, mode select, default rent), row → detail.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  Button,
  cn,
  Input,
  Modal,
  SearchBar,
  Select,
  StatusBadge,
} from "@maxmusic/ui";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatCurrency, formatDate } from "@maxmusic/utils";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/skeleton";
import { PageHeader } from "@/components/page-header";
import { api, mockable } from "@/lib/api";
import { openInstitutionAdminPanel } from "@/lib/impersonation";
import {
  mockImpersonate,
  mockInstitutionAction,
  mockInstitutionList,
  MOCK_INSTITUTIONS,
} from "@/lib/mocks";
import type { ApiResponse, InstitutionListItem, Paginated } from "@/lib/types";

const LIMIT = 10;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const MODE_OPTIONS = [
  { value: "all", label: "All modes" },
  { value: "managed", label: "Managed" },
  { value: "autonomous", label: "Autonomous" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

export default function InstitutionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InstitutionListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);

  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<string | null>("all");
  const [status, setStatus] = useState<string | null>("all");
  const [page, setPage] = useState(1);

  // create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [newMode, setNewMode] = useState<string | null>("managed");
  const [ownerName, setOwnerName] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [rentRupees, setRentRupees] = useState("25000");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        search,
        mode: mode ?? "all",
        status: status ?? "all",
      });
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<InstitutionListItem>>>(
            `/api/operator/institutions?${params}`
          ),
        mockInstitutionList({ page, limit: LIMIT, search, mode: mode ?? "all", status: status ?? "all" })
      );
      if (res.data) {
        setRows(res.data.items);
        setPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load institutions");
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [page, search, mode, status]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const createInstitution = async () => {
    if (!name.trim() || !contactEmail.trim() || !ownerName.trim() || !ownerMobile.trim()) {
      toast.error("Fill in institution name, contact email and owner details");
      return;
    }
    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        mode: newMode,
        contactEmail: contactEmail.trim(),
        owner: { name: ownerName.trim(), mobile: ownerMobile.trim(), email: contactEmail.trim() },
        ...(newMode === "autonomous"
          ? {
              rent: {
                amount: Math.round(Number(rentRupees || "0") * 100),
                billingCycle: "monthly" as const,
                firstDueDate: "2026-07-01",
              },
            }
          : {}),
      };
      const optimistic: InstitutionListItem = {
        _id: `inst_new_${Date.now()}`,
        name: name.trim(),
        slug: slugify(name),
        mode: (newMode ?? "managed") as InstitutionListItem["mode"],
        status: "pending",
        ownerTeacher: { _id: "t_new", name: ownerName.trim(), mobile: ownerMobile.trim() },
        studentCount: 0,
        teacherCount: 1,
        rentStatus: newMode === "autonomous" ? "pending" : "na",
        branding: {
          slug: slugify(name),
          schoolName: name.trim(),
          logoUrl: null,
          primaryColor: "#5B8DEF",
          tagline: null,
        },
        createdAt: new Date().toISOString(),
      };
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ institution: InstitutionListItem }>>(
            "/api/operator/institutions",
            body
          ),
        mockInstitutionAction(optimistic)
      );
      if (res.data) {
        setRows((prev) => [res.data!.institution, ...prev]);
        toast.success(`Institution created — slug "${res.data.institution.slug}"`);
        setCreateOpen(false);
        setName("");
        setContactEmail("");
        setOwnerName("");
        setOwnerMobile("");
        setNewMode("managed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create institution");
    } finally {
      setCreating(false);
    }
  };

  /**
   * "Open panel" eye action — operator god-mode into the institution's admin
   * panel. In production this is Dev A's P3-05 god-token impersonation flow:
   * the POST below returns { url: https://<PLATFORM_DOMAIN>/<slug>/admin?imp=1 }
   * and THAT url is opened. In mock mode we still fire the realCall via
   * mockable() (so flipping NEXT_PUBLIC_API_URL on uses the audited flow),
   * then open the local admin panel app with the mm_impersonate display-hint
   * cookie (see src/lib/impersonation.ts — not a token).
   */
  const openPanel = async (row: InstitutionListItem) => {
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ url: string; expiresInSec: number }>>(
            `/api/operator/institutions/${row._id}/impersonate`,
            { panel: "admin" }
          ),
        mockImpersonate()
      );
      openInstitutionAdminPanel(row); // cookie handshake + new tab + toast
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open admin panel");
    }
  };

  const columns: DataTableColumn<InstitutionListItem>[] = [
    {
      key: "name",
      label: "Institution",
      render: (row) => (
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
            style={{
              backgroundColor: `${row.branding.primaryColor}14`,
              color: row.branding.primaryColor,
            }}
          >
            {row.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">/{row.slug}</p>
          </div>
        </div>
      ),
    },
    { key: "mode", label: "Mode", render: (row) => <StatusBadge status={row.mode} /> },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "studentCount",
      label: "Students",
      render: (row) => <span className="tabular-nums">{row.studentCount}</span>,
    },
    {
      key: "rentStatus",
      label: "Rent",
      render: (row) =>
        row.rentStatus === "na" ? (
          <span className="text-xs text-muted-foreground">Salary</span>
        ) : (
          <StatusBadge status={row.rentStatus} />
        ),
    },
    {
      key: "ownerTeacher",
      label: "Owner",
      render: (row) => (
        <span className="text-muted-foreground">{row.ownerTeacher?.name ?? "—"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row) => (
        <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const blocked = row.status === "suspended" || row.status === "terminated";
        return (
          // span wrapper so the tooltip also shows on the disabled button
          <span
            className="inline-block"
            title={
              blocked
                ? row.status === "suspended"
                  ? "Institution suspended"
                  : "Institution terminated"
                : `Open ${row.name} admin panel with operator access`
            }
          >
            <button
              type="button"
              disabled={blocked}
              onClick={(e) => {
                e.stopPropagation(); // keep row-click → detail page intact
                openPanel(row);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
                blocked
                  ? "cursor-not-allowed bg-muted text-muted-foreground/60"
                  : "bg-brand/10 text-brand hover:bg-brand/15 hover:shadow-[0_0_14px_rgba(91,141,239,0.28)]"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Panel
            </button>
          </span>
        );
      },
    },
  ];

  const noResults = !loading && rows.length === 0;
  const slugPreview = slugify(name);

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Institutions"
        subtitle={`${pagination.total || MOCK_INSTITUTIONS.length} schools under the platform umbrella`}
        actions={
          <Button variant="brand" className="group rounded-full" onClick={() => setCreateOpen(true)}>
            Add Institution
            <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        }
      />

      {/* Filters */}
      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            placeholder="Search by name or slug…"
            className="w-72"
          />
          <Select
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setPage(1);
            }}
            className="w-44"
          />
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            className="w-44"
          />
        </div>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.2}>
        {initial ? (
          <TableSkeleton rows={6} cols={8} />
        ) : noResults ? (
          <EmptyState
            icon={Building2}
            title="No institutions found"
            description="Try adjusting the search or filters — or onboard a new music school to the platform."
            action={
              <Button variant="brand" className="group rounded-full" onClick={() => setCreateOpen(true)}>
                Add Institution
                <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            pagination={{ ...pagination, onPageChange: setPage }}
            onRowClick={(row) => router.push(`/institutions/${row._id}`)}
          />
        )}
      </BlurFade>

      {/* Add Institution modal */}
      <Modal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Add Institution"
        subtitle="Provision a new white-label music school"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="brand" onClick={createInstitution} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Input
              label="Institution name"
              placeholder="e.g. Sargam School of Music"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              URL preview:{" "}
              <span className="font-mono text-brand">
                /{slugPreview || "your-school-slug"}/student
              </span>{" "}
              <span className="opacity-70">(slug is immutable after creation)</span>
            </p>
          </div>

          <Select
            label="Mode"
            options={[
              { value: "managed", label: "Managed — owner teaches on salary" },
              { value: "autonomous", label: "Autonomous — owner runs it, pays rent" },
            ]}
            value={newMode}
            onChange={setNewMode}
            required
          />

          {newMode === "autonomous" && (
            <Input
              label="Default rent (₹ / month)"
              type="number"
              min={0}
              value={rentRupees}
              onChange={(e) => setRentRupees(e.target.value)}
              required
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Owner teacher name"
              placeholder="e.g. Meena Subramaniam"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
            />
            <Input
              label="Owner mobile"
              placeholder="98765 43210"
              value={ownerMobile}
              onChange={(e) => setOwnerMobile(e.target.value)}
              required
            />
          </div>

          <Input
            label="Contact email"
            type="email"
            placeholder="owner@school.example"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />

          {newMode === "autonomous" && rentRupees && (
            <p className="text-xs text-muted-foreground">
              The owner gets <span className="text-brand">teacher + admin</span> panels and pays{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(Math.round(Number(rentRupees) * 100))}
              </span>{" "}
              monthly.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
