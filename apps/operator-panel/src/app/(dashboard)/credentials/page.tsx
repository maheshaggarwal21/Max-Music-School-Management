"use client";
// CRED — cross-institution credential directory + hierarchical password reset.
// Identifiers only (passwords are bcrypt-hashed, irreversible). Reset requires
// the operator to re-enter HIS password; the temp password is shown ONCE.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, Button, Input, Modal, SearchBar, Select, StatusBadge } from "@maxmusic/ui";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { TableSkeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api } from "@/lib/api";
import { useInstitutionOptions } from "@/lib/use-institution-options";
import type { ApiResponse, Paginated } from "@/lib/types";

const LIMIT = 10;

type CredentialRow = {
  _id: string;
  role: "teacher" | "student";
  displayId: string;
  name: string;
  email: string | null;
  mobile: string;
  mobileVerified: boolean;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  institution: { _id: string; name: string; slug: string } | null;
  panelAccess?: string[];
  isOwner?: boolean;
  joinStatus?: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function fmtLastLogin(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "Never"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CredentialsPage() {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [rows, setRows] = useState<CredentialRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(true);

  const [search, setSearch] = useState("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("all");
  const [page, setPage] = useState(1);
  const institutionOptions = useInstitutionOptions();

  const [resetting, setResetting] = useState<CredentialRow | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        role,
        page: String(page),
        limit: String(LIMIT),
        search,
        institutionId: institutionId ?? "",
        status: status === "all" ? "" : status ?? "",
      });
      const res = await api.get<ApiResponse<Paginated<CredentialRow>>>(
        `/api/operator/credentials?${params}`
      );
      if (res.data) {
        setRows(res.data.items);
        setPagination({ ...res.data.pagination, limit: LIMIT });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load credentials");
    } finally {
      setLoading(false);
      setInitial(false);
    }
  }, [role, page, search, institutionId, status]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const columns: DataTableColumn<CredentialRow>[] = [
    {
      key: "displayId",
      label: "ID",
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.displayId}</span>,
    },
    {
      key: "name",
      label: role === "teacher" ? "Teacher" : "Student",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {r.name}
            {r.isOwner && (
              <span className="ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wider text-brand">
                owner
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{r.email ?? "No email"}</p>
        </div>
      ),
    },
    {
      key: "institution",
      label: "Institution",
      render: (r) => (r.institution ? <Tag>{r.institution.name}</Tag> : "—"),
    },
    {
      key: "mobile",
      label: "Mobile (OTP login)",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {r.mobile}
          {r.mobileVerified ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Verified for OTP login" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-label="Not verified" />
          )}
        </span>
      ),
    },
    ...(role === "teacher"
      ? [
          {
            key: "panelAccess",
            label: "Panel Access",
            render: (r: CredentialRow) => (
              <span className="flex flex-wrap gap-1">
                {(r.panelAccess ?? []).map((p) => (
                  <Tag key={p} tone={p === "admin" ? "violet" : "brand"}>
                    {p}
                  </Tag>
                ))}
              </span>
            ),
          } as DataTableColumn<CredentialRow>,
        ]
      : [
          {
            key: "joinStatus",
            label: "Join Status",
            render: (r: CredentialRow) => <Tag tone="neutral">{r.joinStatus ?? "—"}</Tag>,
          } as DataTableColumn<CredentialRow>,
        ]),
    {
      key: "lastLoginAt",
      label: "Last Login",
      render: (r) => <span className="text-xs text-muted-foreground">{fmtLastLogin(r.lastLoginAt)}</span>,
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
            { key: "reset", label: "Reset password", icon: KeyRound, onSelect: () => setResetting(r) },
          ]}
        />
      ),
    },
  ];

  const noResults = !loading && rows.length === 0;

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Credentials"
        subtitle="Login identifiers and password resets — passwords are hashed and can never be viewed, only reset"
      />

      <BlurFade delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Role segmented toggle */}
          <div className="flex rounded-lg border border-border p-0.5">
            {(["teacher", "student"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setPage(1);
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  role === r ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}s
              </button>
            ))}
          </div>
          <SearchBar
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            placeholder="Search name, mobile, email or ID…"
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

      <BlurFade delay={0.2}>
        {initial ? (
          <TableSkeleton rows={8} cols={8} />
        ) : noResults ? (
          <EmptyState
            icon={Users}
            title="No accounts found"
            description="No accounts match the current filters."
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

      {resetting && (
        <ResetPasswordModal
          row={resetting}
          endpoint={`/api/operator/credentials/${resetting.role}/${resetting._id}/reset-password`}
          otpEndpoint="/api/operator/credentials/reset-otp"
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
}

/** Two-step modal: confirm identity (own password OR OTP on own verified
 *  mobile) → one-time temp password reveal. */
function ResetPasswordModal({
  row,
  endpoint,
  otpEndpoint,
  onClose,
}: {
  row: { name: string; displayId: string; role: string };
  endpoint: string;
  otpEndpoint: string;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = method === "password" ? !!password : otp.length >= 6;

  const sendOtp = async () => {
    setBusy(true);
    try {
      await api.post<ApiResponse<null>>(otpEndpoint, {});
      setOtpSent(true);
      toast.success("Code sent to your verified mobile");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const body = method === "password" ? { password } : { otp };
      const res = await api.post<ApiResponse<{ tempPassword: string }>>(endpoint, body);
      if (res.data?.tempPassword) setTempPassword(res.data.tempPassword);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" />
          Reset password
        </span>
      }
      footer={
        tempPassword ? (
          <Button variant="brand" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy || !canSubmit}>
              {busy ? "Resetting…" : "Reset password"}
            </Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Temporary password for <span className="font-semibold text-foreground">{row.name}</span> (
            {row.displayId}). It is shown <span className="font-semibold text-foreground">only once</span> —
            share it securely. They stay logged out everywhere until they sign in with it.
          </p>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <code className="select-all font-mono text-lg tracking-wider">{tempPassword}</code>
            <Button variant="ghost" onClick={copy} aria-label="Copy temporary password">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This generates a new temporary password for{" "}
            <span className="font-semibold text-foreground">{row.name}</span> ({row.displayId}) and{" "}
            <span className="font-semibold text-foreground">signs them out everywhere</span>. Their current
            password stops working immediately.
          </p>
          {/* Identity re-confirmation method */}
          <div className="flex rounded-lg border border-border p-0.5">
            {(["password", "otp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  method === m ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "password" ? "My password" : "OTP to my mobile"}
              </button>
            ))}
          </div>
          {method === "password" ? (
            <Input
              label="Confirm with your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
              autoComplete="current-password"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <Input
                  label="Code from your verified mobile"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={otpSent ? "6-digit code" : "Send the code first"}
                  className="flex-1"
                />
                <Button variant="ghost" onClick={sendOtp} disabled={busy}>
                  {otpSent ? "Resend" : "Send code"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The code goes to <span className="font-medium">your own</span> verified number — never the
                user&apos;s.
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
