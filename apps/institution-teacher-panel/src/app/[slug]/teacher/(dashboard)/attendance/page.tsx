"use client";
// Attendance — the core teacher flow, designed phone-first:
// pick batch → pick date (defaults today) → one-tap mark per student →
// optimistic UI with undo toasts → submit.
//
// Live sync note: marking attendance will emit a Socket.io event to the
// institution room at Handoff H3. See the submit handler below.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarOff,
  Check,
  CheckCheck,
  ClipboardCheck,
  Gift,
  Music2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  BlurFade,
  BorderBeam,
  Button,
  DatePicker,
  GradientText,
  ShinyText,
  cn,
} from "@maxmusic/ui";
import { api, mockable, teacherPath, MOCKS_ENABLED } from "@/lib/api";
import { useSocket } from "@/lib/socket";
import {
  MOCK_BATCHES_RESPONSE,
  MOCK_MARK_OK,
  mockAttendanceDayResponse,
  mockBatchStudentsResponse,
} from "@/lib/mocks";
import type {
  ApiResponse,
  AttendanceCellStatus,
  AttendanceDay,
  BatchRow,
  StudentRow,
} from "@/lib/types";
import { classesOn, toIsoDate } from "@/lib/schedule";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

const MARK_OPTIONS: {
  status: Exclude<AttendanceCellStatus, "unmarked">;
  label: string;
  icon: typeof Check;
  activeClass: string;
}[] = [
  { status: "present", label: "Present", icon: Check, activeClass: "bg-emerald-500 text-white border-emerald-500" },
  { status: "absent", label: "Absent", icon: X, activeClass: "bg-destructive text-white border-destructive" },
  { status: "holiday", label: "Holiday", icon: CalendarOff, activeClass: "bg-amber-500 text-white border-amber-500" },
  { status: "credited", label: "Credited", icon: Gift, activeClass: "bg-brand text-brand-foreground border-brand" },
];

function statusLabel(s: AttendanceCellStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AttendanceContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("batch");

  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(preselected);
  const [date, setDate] = useState<string>(() => toIsoDate(new Date()));
  const [roster, setRoster] = useState<StudentRow[] | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceCellStatus>>({});
  const [saving, setSaving] = useState(false);

  // Live attendance sync — subscribes to the institution's Socket.io room.
  // When another teacher or the admin marks attendance for the same batch+date,
  // reload marks from the server so the sheet stays current.
  const { on: socketOn } = useSocket({ enabled: !MOCKS_ENABLED });

  // Load my batches; default selection = first batch meeting today, else first.
  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<BatchRow[]>>(teacherPath("/batches")),
      MOCK_BATCHES_RESPONSE
    ).then((res) => {
      if (cancelled) return;
      const list = res.data ?? [];
      setBatches(list);
      setBatchId((current) => {
        if (current && list.some((b) => b._id === current)) return current;
        const todays = classesOn(list, new Date());
        return todays[0]?._id ?? list[0]?._id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for live attendance updates from the server (admin corrections or
  // other teacher marks on the same batch). Re-fetch marks from the server
  // when the event targets the currently-viewed batch+date.
  useEffect(() => {
    return socketOn<{ batchId: string; date: string }>(
      "attendance:marked",
      ({ batchId: evtBatch, date: evtDate }) => {
        if (!batchId || evtBatch !== batchId || evtDate !== date) return;
        api
          .get<ApiResponse<AttendanceDay>>(
            teacherPath(`/attendance?batchId=${batchId}&date=${date}`)
          )
          .then((res) => setMarks(res.data?.marks ?? {}))
          .catch(() => {});
      }
    );
  }, [batchId, date, socketOn]);

  // Load roster + existing marks whenever batch/date changes.
  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    setRoster(null);
    setMarks({});
    Promise.all([
      mockable(
        () =>
          api.get<ApiResponse<StudentRow[]>>(
            teacherPath(`/batches/${batchId}/students`)
          ),
        mockBatchStudentsResponse(batchId)
      ),
      mockable(
        () =>
          api.get<ApiResponse<AttendanceDay>>(
            teacherPath(`/attendance?batchId=${batchId}&date=${date}`)
          ),
        mockAttendanceDayResponse(batchId, date)
      ),
    ]).then(([studentsRes, dayRes]) => {
      if (cancelled) return;
      setRoster(studentsRes.data ?? []);
      setMarks(dayRes.data?.marks ?? {});
    });
    return () => {
      cancelled = true;
    };
  }, [batchId, date]);

  const batch = useMemo(
    () => batches?.find((b) => b._id === batchId) ?? null,
    [batches, batchId]
  );

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, holiday: 0, credited: 0, unmarked: 0 };
    for (const s of roster ?? []) {
      counts[marks[s._id] ?? "unmarked"] += 1;
    }
    return counts;
  }, [roster, marks]);

  const total = roster?.length ?? 0;
  const markedCount = total - summary.unmarked;

  // One-tap mark — optimistic, with undo toast.
  const mark = useCallback(
    (student: StudentRow, status: Exclude<AttendanceCellStatus, "unmarked">) => {
      setMarks((prev) => {
        const previous = prev[student._id] ?? "unmarked";
        if (previous === status) return prev; // tap on the same state = no-op
        toast(`${student.name.split(" ")[0]} marked ${statusLabel(status).toLowerCase()}`, {
          duration: 3500,
          action: {
            label: "Undo",
            onClick: () =>
              setMarks((cur) => ({ ...cur, [student._id]: previous })),
          },
        });
        return { ...prev, [student._id]: status };
      });
    },
    []
  );

  // Quick action — everyone present, undo restores the previous sheet.
  const markAllPresent = useCallback(() => {
    if (!roster || roster.length === 0) return;
    setMarks((prev) => {
      const snapshot = { ...prev };
      const next: Record<string, AttendanceCellStatus> = { ...prev };
      for (const s of roster) next[s._id] = "present";
      toast(`All ${roster.length} students marked present`, {
        duration: 4000,
        action: { label: "Undo", onClick: () => setMarks(snapshot) },
      });
      return next;
    });
  }, [roster]);

  const submit = useCallback(async () => {
    if (!batchId || !roster) return;
    // CONTRACTS.md: POST /attendance/mark accepts only present|absent today.
    // Holiday credits go through POST /holidays; "credited" is system-derived.
    const payloadMarks = roster
      .filter((s) => marks[s._id] === "present" || marks[s._id] === "absent")
      .map((s) => ({
        studentId: s._id,
        status: marks[s._id] as "present" | "absent",
      }));
    if (payloadMarks.length === 0) {
      toast.info("Mark at least one student present or absent first");
      return;
    }
    setSaving(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<null>>(teacherPath("/attendance/mark"), {
            batchId,
            date,
            marks: payloadMarks,
          }),
        MOCK_MARK_OK,
        500
      );
      // The server emits `attendance:marked` to the institution room after saving.
      // Our useSocket hook listens and refreshes the grid for all connected clients.
      toast.success(`Attendance saved · ${payloadMarks.length} students`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }, [batchId, date, marks, roster]);

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="!mx-0 !justify-start text-2xl font-bold">
            Attendance
          </GradientText>
          <ShinyText text="One tap per student — undo any time" speed={6} className="mt-1 text-sm" />
        </div>
      </BlurFade>

      {/* Batch chips */}
      <BlurFade delay={0.1}>
        {batches === null ? (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        ) : (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:px-0">
            {batches
              .filter((b) => b.status === "active" || b.status === "setting")
              .map((b) => (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => setBatchId(b._id)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all",
                    batchId === b._id
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Music2 className="h-3.5 w-3.5" />
                  {b.name}
                </button>
              ))}
          </div>
        )}
      </BlurFade>

      {/* Sticky batch header: date + summary bar */}
      {batch && (
        <div className="sticky top-0 z-10 -mx-4 bg-background/90 px-4 py-3 backdrop-blur-md md:mx-0 md:rounded-xl md:border md:border-border md:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {batch.instrument?.name ?? "—"} · {batch.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {batch.timeSlot?.label ?? "—"} · {total} students
              </p>
            </div>
            <DatePicker
              value={date}
              onChange={(v) => v && setDate(v)}
              className="w-44"
            />
          </div>

          {/* Visual summary bar */}
          {total > 0 && (
            <div className="mt-3">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${(summary.present / total) * 100}%` }} />
                <div className="bg-destructive transition-all duration-300" style={{ width: `${(summary.absent / total) * 100}%` }} />
                <div className="bg-amber-500 transition-all duration-300" style={{ width: `${(summary.holiday / total) * 100}%` }} />
                <div className="bg-brand transition-all duration-300" style={{ width: `${(summary.credited / total) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                <span className="font-semibold text-emerald-500">{summary.present} present</span>
                {" · "}
                <span className="font-semibold text-destructive">{summary.absent} absent</span>
                {summary.holiday > 0 && <> · {summary.holiday} holiday</>}
                {summary.credited > 0 && <> · {summary.credited} credited</>}
                {" · "}
                {summary.unmarked} unmarked
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick action */}
      {batch && total > 0 && (
        <BlurFade delay={0.15}>
          <Button
            variant="outline"
            onClick={markAllPresent}
            className="h-11 w-full rounded-xl border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Submit all present
          </Button>
        </BlurFade>
      )}

      {/* Student list — large tap targets */}
      <BlurFade delay={0.2}>
        {!batchId ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No batch selected"
            description="Pick one of your batches above to load its attendance sheet."
          />
        ) : roster === null ? (
          <CardListSkeleton count={5} />
        ) : roster.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No students in this batch"
            description="Once students are assigned, their attendance sheet appears here."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {roster.map((s, i) => {
              const current = marks[s._id] ?? "unmarked";
              return (
                <BlurFade key={s._id} delay={0.22 + Math.min(i, 8) * 0.05} inView>
                  <li
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-card p-3.5 transition-colors",
                      current === "unmarked" ? "border-border" : "border-brand/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={s.name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.displayId}
                            {s.joinStatus === "trial" && (
                              <span className="ml-1.5 rounded-full bg-amber-400/15 px-1.5 py-px text-[10px] font-bold uppercase text-amber-500">
                                trial
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {MARK_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const active = current === opt.status;
                          return (
                            <button
                              key={opt.status}
                              type="button"
                              aria-label={`Mark ${s.name} ${opt.label.toLowerCase()}`}
                              title={opt.label}
                              onClick={() => mark(s, opt.status)}
                              className={cn(
                                "flex h-11 w-11 items-center justify-center rounded-xl border text-muted-foreground transition-all active:scale-95",
                                active
                                  ? opt.activeClass
                                  : "border-border bg-background hover:border-foreground/30 hover:text-foreground"
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                </BlurFade>
              );
            })}
          </ul>
        )}
      </BlurFade>

      {/* Sticky save bar — thumb-friendly on phones (sits above the bottom nav) */}
      {batch && total > 0 && (
        <div className="sticky bottom-2 z-10 md:bottom-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md">
            <BorderBeam size={50} duration={10} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {markedCount}/{total} marked
              </p>
              <Button
                variant="brand"
                size="lg"
                disabled={saving}
                onClick={submit}
                className="h-12 flex-1 rounded-full sm:flex-none sm:px-10"
              >
                {saving ? "Saving…" : "Save attendance"}
                <ClipboardCheck className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<CardListSkeleton count={5} />}>
      <AttendanceContent />
    </Suspense>
  );
}
