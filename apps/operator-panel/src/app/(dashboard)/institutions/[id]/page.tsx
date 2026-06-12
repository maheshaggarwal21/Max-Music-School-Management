"use client";
// P5-04 — Institution detail: Overview (branding preview + stats), Actions
// (grant/revoke admin, suspend/reactivate/terminate, impersonate), Rent table.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Eye,
  LayoutGrid,
  Mail,
  Palette,
  Power,
  ReceiptText,
  ShieldCheck,
  ShieldOff,
  Skull,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  BorderBeam,
  Button,
  cn,
  SpotlightCard,
  StatsCard,
  StatusBadge,
} from "@maxmusic/ui";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatCurrency, formatDate, formatPhone } from "@maxmusic/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";
import { Tabs } from "@/components/tabs";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { openInstitutionAdminPanel } from "@/lib/impersonation";
import {
  mockImpersonate,
  mockInstitutionAction,
  mockInstitutionDetail,
  mockRentInvoiceList,
} from "@/lib/mocks";
import type { ApiResponse, InstitutionDetail, Paginated, RentInvoiceItem } from "@/lib/types";

type ActionKind =
  | "grant-admin"
  | "revoke-admin"
  | "suspend"
  | "reactivate"
  | "terminate"
  | null;

const ACTION_COPY: Record<
  Exclude<ActionKind, null>,
  { title: string; confirm: string; danger: boolean; description: string }
> = {
  "grant-admin": {
    title: "Grant Admin Access",
    confirm: "Grant admin",
    danger: false,
    description:
      "The owner teacher gains the admin panel with their existing credentials. Mode flips to AUTONOMOUS and billing moves to rent. They are logged out once for the change to apply.",
  },
  "revoke-admin": {
    title: "Revoke Admin Access",
    confirm: "Revoke admin",
    danger: true,
    description:
      "Removes the admin panel from the owner teacher. Mode flips back to MANAGED (salary). Their session is invalidated immediately.",
  },
  suspend: {
    title: "Suspend Institution",
    confirm: "Suspend",
    danger: true,
    description:
      "All panels of this institution stop working and every user is logged out (tokenVersion bump). Data is retained. You can reactivate at any time.",
  },
  reactivate: {
    title: "Reactivate Institution",
    confirm: "Reactivate",
    danger: false,
    description: "Restores access to all panels for this institution.",
  },
  terminate: {
    title: "Terminate Institution",
    confirm: "Terminate permanently",
    danger: true,
    description:
      "PERMANENT. The institution is shut down for good. Data is retained for audit but no panel will ever work again. This cannot be undone.",
  },
};

export default function InstitutionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [inst, setInst] = useState<InstitutionDetail | null>(null);
  const [rents, setRents] = useState<RentInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState<ActionKind>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, rentRes] = await Promise.all([
        mockable(
          () =>
            api.get<ApiResponse<InstitutionDetail | { institution: InstitutionDetail }>>(
              `/api/operator/institutions/${id}`
            ),
          mockInstitutionDetail(id)
        ),
        mockable(
          () =>
            api.get<ApiResponse<Paginated<RentInvoiceItem>>>(
              `/api/operator/rent-invoices?institutionId=${id}&limit=50`
            ),
          mockRentInvoiceList({ institutionId: id, limit: 50 })
        ),
      ]);
      // Live API wraps as { institution }, mocks return the detail directly.
      const detail =
        detailRes.data && "institution" in detailRes.data
          ? detailRes.data.institution
          : detailRes.data;
      if (detail) setInst(detail);
      if (rentRes.data) setRents(rentRes.data.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load institution");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (kind: Exclude<ActionKind, null>) => {
    if (!inst) return;
    const after: InstitutionDetail = {
      ...inst,
      ...(kind === "grant-admin" ? { mode: "autonomous" as const } : {}),
      ...(kind === "revoke-admin" ? { mode: "managed" as const } : {}),
      ...(kind === "suspend" ? { status: "suspended" as const } : {}),
      ...(kind === "reactivate" ? { status: "active" as const } : {}),
      ...(kind === "terminate" ? { status: "terminated" as const } : {}),
    };
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ institution: InstitutionDetail }>>(
            `/api/operator/institutions/${id}/${kind}`,
            {}
          ),
        mockInstitutionAction(after)
      );
      setInst(after);
      toast.success(`${ACTION_COPY[kind].title} — done`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      throw err;
    }
  };

  const impersonate = async (panel: "admin" | "teacher" | "student") => {
    if (!inst) return;
    try {
      // In production this is Dev A's P3-05 god-token endpoint — the returned
      // url (https://<PLATFORM_DOMAIN>/<slug>/admin?imp=1) is what gets opened.
      await mockable(
        () =>
          api.post<ApiResponse<{ url: string; expiresInSec: number }>>(
            `/api/operator/institutions/${id}/impersonate`,
            { panel }
          ),
        mockImpersonate()
      );
      if (panel === "admin") {
        // Same eye action as the institutions list: mm_impersonate display-hint
        // cookie (not a token — see src/lib/impersonation.ts) + new tab + toast.
        openInstitutionAdminPanel({ slug: inst.slug, name: inst.name });
        return;
      }
      toast.success("Impersonation token issued (mock)", {
        description: `Short-lived god-token for the ${panel} panel. Every action will be audited as superadmin.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impersonation failed");
    }
  };

  const rentColumns: DataTableColumn<RentInvoiceItem>[] = [
    { key: "period", label: "Period", render: (r) => <span className="font-medium">{r.period}</span> },
    { key: "amount", label: "Amount", render: (r) => <span className="tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: "dueDate", label: "Due date", render: (r) => <span className="text-muted-foreground">{formatDate(r.dueDate)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "paidAt", label: "Paid at", render: (r) => <span className="text-muted-foreground">{r.paidAt ? formatDate(r.paidAt) : "—"}</span> },
    { key: "reference", label: "Reference", render: (r) => r.reference ? <Tag tone="neutral" className="font-mono">{r.reference}</Tag> : <span className="text-muted-foreground">—</span> },
  ];

  if (loading || !inst) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const isManaged = inst.mode === "managed";
  const isActive = inst.status === "active";
  const isTerminated = inst.status === "terminated";
  const isSuspended = inst.status === "suspended";

  return (
    <div className="relative flex flex-col gap-6 p-4 sm:p-6">
      <BlurFade delay={0}>
        <Link
          href="/institutions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All institutions
        </Link>
      </BlurFade>

      <PageHeader
        title={inst.name}
        subtitle={`/${inst.slug} · owner ${inst.ownerTeacher?.name ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={inst.mode} />
            <StatusBadge status={inst.status} />
          </div>
        }
      />

      <BlurFade delay={0.1}>
        <Tabs
          tabs={[
            { key: "overview", label: "Overview", icon: LayoutGrid },
            { key: "actions", label: "Actions", icon: ShieldCheck },
            { key: "rent", label: "Rent Invoices", icon: ReceiptText },
          ]}
          active={tab}
          onChange={setTab}
        />
      </BlurFade>

      {tab === "overview" && (
        <>
          <BlurFade delay={0.15}>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Branding preview card */}
              <SpotlightCard className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
                <BorderBeam size={50} duration={9} />
                <div className="mb-4 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand" />
                  <h2 className="text-sm font-semibold">White-label branding</h2>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md"
                    style={{ backgroundColor: inst.branding.primaryColor }}
                  >
                    {inst.branding.schoolName.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{inst.branding.schoolName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inst.branding.tagline ?? "No tagline set"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: inst.branding.primaryColor }}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {inst.branding.primaryColor}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {inst.contactEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5" />
                    {inst.ownerTeacher
                      ? `${inst.ownerTeacher.name} · ${formatPhone(inst.ownerTeacher.mobile)}`
                      : "No owner assigned"}
                  </p>
                  {inst.rent && (
                    <p className="flex items-center gap-2">
                      <ReceiptText className="h-3.5 w-3.5" />
                      {formatCurrency(inst.rent.amount)} / {inst.rent.billingCycle} · next due{" "}
                      {formatDate(inst.rent.nextDueDate)}
                    </p>
                  )}
                </div>
              </SpotlightCard>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                <StatsCard label="Active Students" value={inst.counts.activeStudents} trend="currently enrolled" />
                <StatsCard label="Trial Students" value={inst.counts.trialStudents} trend="in trial window" />
                <StatsCard label="Batches" value={inst.counts.batches} trend="across all teachers" />
                <StatsCard label="Teachers" value={inst.teacherCount} trend={isManaged ? "on salary" : "owner pays rent"} />
              </div>
            </div>
          </BlurFade>
        </>
      )}

      {tab === "actions" && (
        <BlurFade delay={0.15}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PBAC / mode */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
              <BorderBeam size={50} duration={10} />
              <h2 className="text-sm font-semibold">Panel access (PBAC)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                One credential — the owner teacher&apos;s login opens whichever panels are granted.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Tag>teacher</Tag>
                {!isManaged && <Tag tone="violet">admin</Tag>}
                <span className="text-xs text-muted-foreground">
                  current access for {inst.ownerTeacher?.name ?? "owner"}
                </span>
              </div>
              <div className="mt-5">
                {isManaged ? (
                  <Button
                    variant="brand"
                    className="rounded-full"
                    disabled={isTerminated}
                    onClick={() => setAction("grant-admin")}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Grant Admin Access
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-full text-destructive hover:bg-destructive/10"
                    disabled={isTerminated}
                    onClick={() => setAction("revoke-admin")}
                  >
                    <ShieldOff className="h-4 w-4" />
                    Revoke Admin Access
                  </Button>
                )}
              </div>
            </div>

            {/* Impersonation */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
              <BorderBeam size={50} duration={10} delay={2} />
              <h2 className="text-sm font-semibold">Impersonate (god-mode)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Issues a short-lived god-token. Every action is audited as superadmin with
                impersonatedBy stamped.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(["admin", "teacher", "student"] as const).map((panel) => (
                  <span
                    key={panel}
                    className="inline-block"
                    title={
                      isSuspended
                        ? "Institution suspended"
                        : isTerminated
                          ? "Institution terminated"
                          : panel === "admin"
                            ? `Open ${inst.name} admin panel with operator access`
                            : undefined
                    }
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "rounded-full",
                        panel === "admin" &&
                          "border-brand/30 bg-brand/10 text-brand hover:bg-brand/15 hover:text-brand hover:shadow-[0_0_14px_rgba(91,141,239,0.28)]"
                      )}
                      disabled={isTerminated || isSuspended}
                      onClick={() => impersonate(panel)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {panel.charAt(0).toUpperCase() + panel.slice(1)} panel
                    </Button>
                  </span>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            <div className="relative overflow-hidden rounded-xl border border-destructive/30 bg-card p-6 lg:col-span-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <Ban className="h-4 w-4" /> Danger zone
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Suspension logs out every user of this institution. Termination is permanent.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {isActive ? (
                  <Button variant="destructive" className="rounded-full" onClick={() => setAction("suspend")}>
                    <Power className="h-4 w-4" /> Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={isTerminated}
                    onClick={() => setAction("reactivate")}
                  >
                    <Power className="h-4 w-4" /> Reactivate
                  </Button>
                )}
                <Button
                  variant="destructive"
                  className="rounded-full opacity-90"
                  disabled={isTerminated}
                  onClick={() => setAction("terminate")}
                >
                  <Skull className="h-4 w-4" /> Terminate
                </Button>
              </div>
            </div>
          </div>
        </BlurFade>
      )}

      {tab === "rent" && (
        <BlurFade delay={0.15}>
          {rents.length === 0 ? (
            <EmptyRent isManaged={isManaged} />
          ) : (
            <DataTable columns={rentColumns} data={rents} />
          )}
        </BlurFade>
      )}

      {/* Confirm modal for all actions */}
      {action && (
        <ConfirmModal
          open={!!action}
          onClose={() => setAction(null)}
          title={ACTION_COPY[action].title}
          description={
            <>
              <span className="font-medium text-foreground">{inst.name}</span> —{" "}
              {ACTION_COPY[action].description}
            </>
          }
          confirmLabel={ACTION_COPY[action].confirm}
          danger={ACTION_COPY[action].danger}
          onConfirm={() => runAction(action)}
        />
      )}
    </div>
  );
}

function EmptyRent({ isManaged }: { isManaged: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card px-6 py-14 text-center">
      <BorderBeam size={50} duration={10} />
      <ReceiptText className="mx-auto h-8 w-8 text-brand" />
      <p className="mt-3 text-sm font-semibold">No rent invoices</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        {isManaged
          ? "This institution is MANAGED — the owner is on salary, so no rent is billed."
          : "Invoices appear here once the first billing cycle starts."}
      </p>
    </div>
  );
}
