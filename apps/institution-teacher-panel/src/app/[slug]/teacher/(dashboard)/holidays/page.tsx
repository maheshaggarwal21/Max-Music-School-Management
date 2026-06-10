"use client";
// Holidays — institution-declared holidays (read-only) + my requested holidays
// with a request modal (DatePicker + reason). A holiday credits the class back
// to students of the chosen category.

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  BorderBeam,
  Button,
  DatePicker,
  GradientText,
  Input,
  Modal,
  Select,
  ShinyText,
  StatusBadge,
  cn,
} from "@maxmusic/ui";
import { formatDate } from "@maxmusic/utils";
import { api, mockable, teacherPath } from "@/lib/api";
import {
  MOCK_BATCHES_RESPONSE,
  MOCK_INSTITUTION_HOLIDAYS_RESPONSE,
  MOCK_MY_HOLIDAYS_RESPONSE,
  MOCK_OK,
  mockCreatedHoliday,
} from "@/lib/mocks";
import type { ApiResponse, BatchRow, HolidayItem } from "@/lib/types";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

// UI-only request state. CONTRACTS.md HolidayItem has no approval field — a
// teacher POST creates the holiday directly; newly-submitted entries are shown
// as "pending" until the list is refetched (flagged to Dev A for a real
// status/owner discriminator).
type MyHoliday = { item: HolidayItem; uiStatus: "approved" | "pending" };

function HolidayRow({
  item,
  badge,
  onDelete,
  delay,
}: {
  item: HolidayItem;
  badge?: "approved" | "pending";
  onDelete?: () => void;
  delay: number;
}) {
  const upcoming = new Date(`${item.date}T00:00:00`) >= new Date(new Date().toDateString());
  return (
    <BlurFade delay={delay} inView>
      <li className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg",
                upcoming ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"
              )}
            >
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{formatDate(item.date)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.batch.name} · {item.studentCategory} students
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge && <StatusBadge status={badge} />}
            {onDelete && (
              <button
                type="button"
                aria-label="Withdraw holiday request"
                onClick={onDelete}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </li>
    </BlurFade>
  );
}

export default function HolidaysPage() {
  const [institutionHolidays, setInstitutionHolidays] = useState<HolidayItem[] | null>(null);
  const [myHolidays, setMyHolidays] = useState<MyHoliday[] | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);

  // Request modal state
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>("regular");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // NOTE: both lists come from GET /holidays today; the split (institution vs
    // mine) needs an owner field or ?mine=1 filter in CONTRACTS.md — flagged to Dev A.
    mockable(
      () => api.get<ApiResponse<HolidayItem[]>>(teacherPath("/holidays")),
      MOCK_INSTITUTION_HOLIDAYS_RESPONSE
    ).then((res) => {
      if (!cancelled) setInstitutionHolidays(res.data ?? []);
    });
    mockable(
      () => api.get<ApiResponse<HolidayItem[]>>(teacherPath("/holidays?mine=1")),
      MOCK_MY_HOLIDAYS_RESPONSE
    ).then((res) => {
      if (!cancelled)
        setMyHolidays((res.data ?? []).map((item) => ({ item, uiStatus: "approved" })));
    });
    mockable(
      () => api.get<ApiResponse<BatchRow[]>>(teacherPath("/batches")),
      MOCK_BATCHES_RESPONSE
    ).then((res) => {
      if (!cancelled) setBatches(res.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const batchOptions = useMemo(
    () =>
      batches
        .filter((b) => b.status === "active" || b.status === "setting")
        .map((b) => ({
          value: b._id,
          label: `${b.name} · ${b.instrument?.name ?? ""}`.trim(),
        })),
    [batches]
  );

  const resetForm = () => {
    setBatchId(null);
    setDate(null);
    setCategory("regular");
    setReason("");
  };

  const submitRequest = async () => {
    if (!batchId || !date || !category) {
      toast.error("Pick a batch, date and student category");
      return;
    }
    setSubmitting(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<HolidayItem>>(teacherPath("/holidays"), {
            batchId,
            date,
            studentCategory: category as "regular" | "trial",
            reason: reason.trim() || undefined,
          }),
        mockCreatedHoliday(batchId, date, category as "regular" | "trial", reason.trim() || undefined),
        500
      );
      if (res.data) {
        const created = res.data;
        setMyHolidays((prev) => [{ item: created, uiStatus: "pending" }, ...(prev ?? [])]);
        toast.success(`Holiday requested for ${formatDate(created.date)}`);
        setOpen(false);
        resetForm();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request holiday");
    } finally {
      setSubmitting(false);
    }
  };

  const withdraw = async (h: MyHoliday) => {
    // Optimistic remove + undo toast.
    setMyHolidays((prev) => (prev ?? []).filter((x) => x.item._id !== h.item._id));
    toast(`Withdrew holiday on ${formatDate(h.item.date)}`, {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => setMyHolidays((prev) => [h, ...(prev ?? [])]),
      },
    });
    try {
      await mockable(
        () => api.delete<ApiResponse<null>>(teacherPath(`/holidays/${h.item._id}`)),
        MOCK_OK
      );
    } catch {
      setMyHolidays((prev) => [h, ...(prev ?? [])]);
      toast.error("Could not withdraw — restored");
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <GradientText className="!mx-0 !justify-start text-2xl font-bold">
              Holidays
            </GradientText>
            <ShinyText
              text="Holidays credit the class back to your students"
              speed={6}
              className="mt-1 text-sm"
            />
          </div>
          <Button variant="brand" className="group rounded-full" onClick={() => setOpen(true)}>
            Request holiday
            <Plus className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
          </Button>
        </div>
      </BlurFade>

      {/* My requests */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            My requests
          </h2>
          {myHolidays === null ? (
            <CardListSkeleton count={2} />
          ) : myHolidays.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="No holiday requests yet"
              description="Need a day off? Request a holiday and your students get the class credited back."
              action={
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
                  Request one
                  <Plus className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {myHolidays.map((h, i) => (
                <HolidayRow
                  key={h.item._id}
                  item={h.item}
                  badge={h.uiStatus}
                  onDelete={() => withdraw(h)}
                  delay={0.12 + i * 0.06}
                />
              ))}
            </ul>
          )}
        </div>
      </BlurFade>

      {/* Institution holidays — read-only */}
      <BlurFade delay={0.2}>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            School holidays
          </h2>
          {institutionHolidays === null ? (
            <CardListSkeleton count={3} />
          ) : institutionHolidays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No school holidays declared"
              description="Holidays declared by your school admin will show up here."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {institutionHolidays.map((h, i) => (
                <HolidayRow key={h._id} item={h} delay={0.22 + i * 0.06} />
              ))}
            </ul>
          )}
        </div>
      </BlurFade>

      {/* Request modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request a holiday"
        subtitle="The class is credited back to the selected student category"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" className="rounded-full" disabled={submitting} onClick={submitRequest}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Batch"
            required
            options={batchOptions}
            value={batchId}
            onChange={setBatchId}
            placeholder="Select a batch"
          />
          <DatePicker label="Date" required value={date} onChange={setDate} />
          <Select
            label="Student category"
            required
            options={[
              { value: "regular", label: "Regular students" },
              { value: "trial", label: "Trial students" },
            ]}
            value={category}
            onChange={setCategory}
          />
          <Input
            label="Reason"
            placeholder="e.g. Personal — family function"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
