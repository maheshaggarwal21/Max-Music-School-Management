"use client";
// Slug change requests — institution admins can only REQUEST a new public
// address; approving here is the single sanctioned path that actually changes
// a slug (it logs out the whole institution and breaks old links).

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BorderBeam, Button, Input, cn } from "@maxmusic/ui";
import { ConfirmModal } from "@/components/confirm-modal";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";
import { Tabs } from "@/components/tabs";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import { mockSlugRequestHandled, mockSlugRequestList } from "@/lib/mocks";
import type { ApiResponse, Paginated, SlugChangeRequestRow } from "@/lib/types";

const STATUS_TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_TONE: Record<SlugChangeRequestRow["status"], "amber" | "brand" | "neutral"> = {
  pending: "amber",
  approved: "brand",
  rejected: "neutral",
};

function dateOf(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function SlugDiff({ from, to }: { from: string; to: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground line-through decoration-destructive/60">
        /{from}
      </code>
      <ArrowRight className="h-3.5 w-3.5 text-brand" />
      <code className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
        /{to}
      </code>
    </span>
  );
}

export default function SlugRequestsPage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<SlugChangeRequestRow[] | null>(null);
  const [approving, setApproving] = useState<SlugChangeRequestRow | null>(null);
  const [rejecting, setRejecting] = useState<SlugChangeRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchItems = useCallback(async () => {
    setItems(null);
    try {
      const res = await mockable(
        () =>
          api.get<ApiResponse<Paginated<SlugChangeRequestRow>>>(
            `/api/operator/slug-requests?status=${status}&page=1&limit=50`
          ),
        mockSlugRequestList({ status })
      );
      setItems(res.data?.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load slug requests");
      setItems([]);
    }
  }, [status]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const approve = async () => {
    if (!approving) return;
    await mockable(
      () => api.post<ApiResponse<unknown>>(`/api/operator/slug-requests/${approving._id}/approve`, {}),
      mockSlugRequestHandled(approving._id, "approved") as ApiResponse<unknown>
    );
    toast.success(`Slug changed to /${approving.requestedSlug}`, {
      description: "Every session of that institution has been logged out.",
    });
    fetchItems();
  };

  const reject = async () => {
    if (!rejecting) return;
    await mockable(
      () => api.post<ApiResponse<unknown>>(`/api/operator/slug-requests/${rejecting._id}/reject`, {
        reason: rejectReason || undefined,
      }),
      mockSlugRequestHandled(rejecting._id, "rejected", rejectReason || undefined) as ApiResponse<unknown>
    );
    toast.success("Request rejected");
    setRejectReason("");
    fetchItems();
  };

  return (
    <div className="relative flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Slug Requests"
        subtitle="Institution admins request public-address changes — approval applies them instantly"
      />

      <BlurFade delay={0.1}>
        <Tabs tabs={STATUS_TABS} active={status} onChange={setStatus} />
      </BlurFade>

      <BlurFade delay={0.2}>
        {!items ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Link2}
            title={status === "pending" ? "No pending requests" : "Nothing here"}
            description="When an institution admin requests a new public address from their settings, it lands in this queue for your decision."
          />
        ) : (
          <div className="space-y-3">
            {items.map((r, i) => (
              <BlurFade key={r._id} delay={0.04 * i}>
                <div className="relative overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
                  <BorderBeam size={40} duration={12} delay={i * 1.5} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">
                          {r.institution.name ?? "Institution"}
                        </span>
                        <Tag tone={STATUS_TONE[r.status]}>{r.status}</Tag>
                      </div>
                      <div className="mt-1.5">
                        <SlugDiff from={r.currentSlug} to={r.requestedSlug} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {r.requestedBy?.actorName ? `Requested by ${r.requestedBy.actorName} · ` : ""}
                        {dateOf(r.createdAt)}
                        {r.reason && <> · “{r.reason}”</>}
                        {r.status === "rejected" && r.rejectionReason && (
                          <> · rejected: {r.rejectionReason}</>
                        )}
                        {r.status !== "pending" && r.handledAt && <> · decided {dateOf(r.handledAt)}</>}
                      </p>
                    </div>

                    {r.status === "pending" && (
                      <div className={cn("flex shrink-0 items-center gap-1.5")}>
                        <Button
                          size="sm"
                          variant="brand"
                          className="rounded-full"
                          onClick={() => setApproving(r)}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setRejecting(r);
                            setRejectReason("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        )}
      </BlurFade>

      {/* Approve — disruptive, spell out the consequences */}
      <ConfirmModal
        open={!!approving}
        onClose={() => setApproving(null)}
        danger
        title="Approve slug change"
        confirmLabel="Approve & Change Slug"
        description={
          approving ? (
            <span>
              <SlugDiff from={approving.currentSlug} to={approving.requestedSlug} />
              <span className="mt-2 block">
                This changes the institution&apos;s public URL <strong>immediately</strong>, logs
                out all of its users, and old links stop working.
              </span>
            </span>
          ) : null
        }
        onConfirm={approve}
      />

      {/* Reject */}
      <ConfirmModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject slug change"
        confirmLabel="Reject Request"
        description={
          rejecting
            ? `Reject the request from ${rejecting.institution.name ?? "this institution"} to become /${rejecting.requestedSlug}?`
            : null
        }
        onConfirm={reject}
      >
        <Input
          label="Reason (optional — shown to the admin)"
          placeholder="e.g. Too generic, pick something more specific"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </ConfirmModal>
    </div>
  );
}
