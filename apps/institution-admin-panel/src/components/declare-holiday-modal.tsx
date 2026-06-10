"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, DatePicker, Input, Modal, Select, cn } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_BATCHES, ok, paginate } from "@/lib/mocks";
import type { ApiResponse, BatchRow, HolidayItem, Paginated } from "@/lib/types";

// Declare-holiday modal. Two scopes:
//  - one batch  (fixedBatchId set, or picked from the select)
//  - ALL active batches (festival days) — the backend fans out one holiday per
//    batch and credits a class back to matching-category students. Declared
//    holidays surface on the teacher and student panels too.

export interface DeclareHolidayModalProps {
  open: boolean;
  onClose: () => void;
  /** Lock the modal to one batch (batch detail page). */
  fixedBatchId?: string;
  fixedBatchName?: string;
  /** Receives the holidays created (for optimistic list updates). */
  onDeclared: (holidays: HolidayItem[]) => void;
}

export function DeclareHolidayModal({
  open, onClose, fixedBatchId, fixedBatchName, onDeclared,
}: DeclareHolidayModalProps) {
  const allowAll = !fixedBatchId;
  const [scope, setScope] = useState<"all" | "one">(allowAll ? "all" : "one");
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [batchId, setBatchId] = useState<string | null>(fixedBatchId ?? null);
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>("regular");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope(allowAll ? "all" : "one");
    setBatchId(fixedBatchId ?? null);
    setDate(null);
    setCategory("regular");
    setReason("");
    if (allowAll || !fixedBatchId) {
      let cancelled = false;
      mockable(
        () => api.get<ApiResponse<Paginated<BatchRow>>>(adminPath("/batches?page=1&limit=100")),
        ok(paginate(MOCK_BATCHES))
      ).then((r) => !cancelled && setBatches(r.data?.items ?? []));
      return () => {
        cancelled = true;
      };
    }
  }, [open, allowAll, fixedBatchId]);

  const activeBatches = batches.filter((b) => b.status === "active" || b.status === "setting");

  const declare = async () => {
    if (!date) return toast.error("Pick a date");
    const targetBatchId = fixedBatchId ?? batchId;
    if (scope === "one" && !targetBatchId) return toast.error("Select a batch");
    setSaving(true);
    try {
      const body =
        scope === "all"
          ? { allBatches: true, date, studentCategory: category ?? "regular", reason: reason || undefined }
          : { batchId: targetBatchId, date, studentCategory: category ?? "regular", reason: reason || undefined };

      // Mock fallback mirrors the backend fan-out.
      const targets =
        scope === "all"
          ? activeBatches.filter((b) => b.status === "active")
          : [
              batches.find((b) => b._id === targetBatchId) ??
                ({ _id: targetBatchId!, name: fixedBatchName ?? "Batch" } as BatchRow),
            ];
      const mockHolidays: HolidayItem[] = targets.map((b, i) => ({
        _id: `hol_local_${Date.now()}_${i}`,
        batch: { _id: b._id, name: b.name },
        date,
        studentCategory: (category ?? "regular") as "regular" | "trial",
        reason: reason || null,
      }));

      const res = await mockable(
        () =>
          api.post<ApiResponse<{ holidays: HolidayItem[]; declared: number }>>(
            adminPath("/holidays"),
            body
          ),
        ok({ holidays: mockHolidays, declared: mockHolidays.length }),
        500
      );

      const created = res.data?.holidays ?? mockHolidays;
      onDeclared(created);
      toast.success(
        scope === "all"
          ? `Holiday declared for ${res.data?.declared ?? created.length} batches`
          : "Holiday declared",
        {
          description:
            "Affected students get a class credited back — visible on the teacher and student panels.",
        }
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not declare the holiday");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Declare Holiday"
      subtitle={
        fixedBatchName
          ? `For ${fixedBatchName}`
          : "Students in the affected batches get the class credited back"
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="brand" onClick={declare} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Declare Holiday
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {allowAll && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Scope</span>
            <div className="flex gap-1 rounded-lg bg-muted/60 p-1">
              {(
                [
                  ["all", "All active batches"],
                  ["one", "One batch"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    scope === value
                      ? "bg-card text-brand shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {scope === "one" && !fixedBatchId && (
          <Select
            label="Batch"
            required
            searchable
            placeholder="Select batch"
            options={activeBatches.map((b) => ({ value: b._id, label: b.name }))}
            value={batchId}
            onChange={setBatchId}
          />
        )}

        <DatePicker label="Date" required value={date} onChange={setDate} />
        <Select
          label="Student category"
          options={[
            { value: "regular", label: "Regular students" },
            { value: "trial", label: "Trial students" },
          ]}
          value={category}
          onChange={setCategory}
        />
        <Input
          label="Reason"
          placeholder="e.g. Guru Purnima"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
