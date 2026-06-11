"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarOff, ClipboardCheck, Clock, ExternalLink, Eye, Loader2,
  Music2, Play, Plus, Trash2, User, Users, Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, Button, Input, Modal, Select, StatusBadge, cn,
} from "@maxmusic/ui";
import { formatDate, formatPhone } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_HOLIDAYS, MOCK_TEACHERS, mockAttendanceGrid, mockBatchAttendanceClasses, mockBatchDetail,
  mockBatchRoster, mockBatchSessions, ok, paginate,
} from "@/lib/mocks";
import type {
  ApiResponse, AttendanceGrid, BatchAttendanceClass, BatchDetail,
  BatchStudentItem, ClassSessionItem, HolidayItem, Paginated,
} from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { ConfirmModal } from "@/components/confirm-modal";
import { DeclareHolidayModal } from "@/components/declare-holiday-modal";
import { EmptyState } from "@/components/empty-state";
import { Skeleton, TableSkeleton } from "@/components/skeletons";
import { Toggle } from "@/components/toggle";
import { Avatar } from "@maxmusic/ui";

// Batch console: OVERVIEW (launch session + archive) · HOLIDAY · ATTENDANCE ·
// STUDENTS. Everything scoped to this batch.

const TABS = ["Overview", "Holiday", "Attendance", "Students"] as const;
type Tab = (typeof TABS)[number];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; slug: string }>();
  const base = `/${params?.slug}/admin`;
  const batchId = params?.id ?? "";

  const [tab, setTab] = useState<Tab>("Overview");
  const [batch, setBatch] = useState<BatchDetail | null>(null);

  // Overview
  const [sessions, setSessions] = useState<ClassSessionItem[] | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [targetDate, setTargetDate] = useState(isoToday());
  const [launching, setLaunching] = useState(false);

  // Holiday
  const [holidays, setHolidays] = useState<HolidayItem[] | null>(null);
  const [holidayModal, setHolidayModal] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayItem | null>(null);

  // Attendance
  const [classes, setClasses] = useState<BatchAttendanceClass[] | null>(null);
  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [dayGrid, setDayGrid] = useState<AttendanceGrid | null>(null);

  // Students
  const [roster, setRoster] = useState<BatchStudentItem[] | null>(null);

  // Assign teacher (a setting-phase batch activates once one is assigned)
  const [assignOpen, setAssignOpen] = useState(false);
  const [teachers, setTeachers] = useState<{ _id: string; name: string; status: string }[] | null>(null);
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;

    mockable(
      () => api.get<ApiResponse<{ batch: BatchDetail }>>(adminPath(`/batches/${batchId}`)),
      ok(mockBatchDetail(batchId) ? { batch: mockBatchDetail(batchId)! } : null)
    ).then((r) => {
      if (cancelled) return;
      if (!r.data?.batch) {
        toast.error("Batch not found");
        router.replace(`${base}/batches`);
        return;
      }
      setBatch(r.data.batch);
    });

    mockable(
      () =>
        api.get<ApiResponse<Paginated<ClassSessionItem>>>(
          adminPath(`/batches/${batchId}/sessions?page=1&limit=30`)
        ),
      ok(paginate(mockBatchSessions(batchId)))
    ).then((r) => !cancelled && setSessions(r.data?.items ?? []));

    mockable(
      () =>
        api.get<ApiResponse<{ holidays: HolidayItem[] }>>(
          adminPath(`/holidays?batchId=${batchId}`)
        ),
      ok({ holidays: MOCK_HOLIDAYS.filter((h) => h.batch._id === batchId) })
    ).then((r) => !cancelled && setHolidays(r.data?.holidays ?? []));

    mockable(
      () =>
        api.get<ApiResponse<{ batch: unknown; classes: BatchAttendanceClass[] }>>(
          adminPath(`/batches/${batchId}/attendance-summary`)
        ),
      ok({ batch: null as unknown, classes: mockBatchAttendanceClasses(batchId) })
    ).then((r) => !cancelled && setClasses(r.data?.classes ?? []));

    mockable(
      () =>
        api.get<ApiResponse<{ batch: unknown; students: BatchStudentItem[] }>>(
          adminPath(`/batches/${batchId}/students`)
        ),
      ok({ batch: null as unknown, students: mockBatchRoster(batchId) })
    ).then((r) => !cancelled && setRoster(r.data?.students ?? []));

    return () => {
      cancelled = true;
    };
  }, [batchId, router]);

  const launch = async () => {
    const url = meetingUrl.trim();
    if (!url) return toast.error("Enter the meeting URL");
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      return toast.error("That doesn't look like a valid URL");
    }
    setLaunching(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ session: ClassSessionItem }>>(
            adminPath(`/batches/${batchId}/sessions`),
            { meetingUrl: url, targetDate }
          ),
        ok({
          session: {
            _id: `ses_local_${Date.now()}`,
            meetingUrl: url,
            targetDate: `${targetDate}T00:00:00.000Z`,
            launchedAt: new Date().toISOString(),
            launchedBy: { actorRole: "institution_admin" },
          },
        }),
        500
      );
      if (res.data?.session) {
        setSessions((prev) => [res.data!.session, ...(prev ?? [])]);
      }
      setMeetingUrl("");
      toast.success("Session launched", {
        description: `Link saved to the archive for ${formatDate(targetDate)}.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not launch the session");
    } finally {
      setLaunching(false);
    }
  };

  const deleteHoliday = async () => {
    if (!deletingHoliday) return;
    await mockable(
      () => api.delete<ApiResponse>(adminPath(`/holidays/${deletingHoliday._id}`)),
      ok(null),
      400
    );
    setHolidays((prev) => (prev ?? []).filter((h) => h._id !== deletingHoliday._id));
    toast.success("Holiday removed — the credited class is reversed");
  };

  const viewAttendance = useCallback(
    async (date: string) => {
      setViewingDate(date);
      setDayGrid(null);
      const today = new Date(date);
      const res = await mockable(
        () =>
          api.get<ApiResponse<AttendanceGrid>>(
            adminPath(`/attendance?batchId=${batchId}&from=${date}&to=${date}`)
          ),
        ok(mockAttendanceGrid(batchId, today.getFullYear(), today.getMonth()))
      );
      setDayGrid(res.data ?? null);
    },
    [batchId]
  );

  const markFor = (marks: Record<string, string>, date: string) => marks[date] ?? "unmarked";

  // Admin correction: flip a student present/absent for the open date.
  // Optimistic grid + summary update, then persisted via the mark endpoint.
  const setMark = async (studentId: string, status: "present" | "absent") => {
    if (!viewingDate || !dayGrid) return;
    const date = viewingDate;
    const prevMark = markFor(
      dayGrid.rows.find((r) => r.student._id === studentId)?.marks ?? {},
      date
    );
    if (prevMark === status) return;

    setDayGrid((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              r.student._id === studentId
                ? { ...r, marks: { ...r.marks, [date]: status } }
                : r
            ),
          }
        : prev
    );
    setClasses((prev) =>
      (prev ?? []).map((c) => {
        if (c.date !== date) return c;
        const next = { ...c };
        if (prevMark === "present") next.present -= 1;
        if (prevMark === "absent") next.absent -= 1;
        if (prevMark === "holiday") next.holiday -= 1;
        if (prevMark === "credited") next.credited -= 1;
        if (prevMark === "unmarked") next.total += 1;
        if (status === "present") next.present += 1;
        else next.absent += 1;
        return next;
      })
    );

    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ applied: number }>>(adminPath("/attendance/mark"), {
            batchId,
            date,
            marks: [{ studentId, status }],
          }),
        ok({ applied: 1 }),
        250
      );
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the mark");
    }
  };

  const openAssign = () => {
    setAssignOpen(true);
    if (teachers) return;
    mockable(
      () =>
        api.get<ApiResponse<Paginated<{ _id: string; name: string; status: string }>>>(
          adminPath("/teachers?page=1&limit=100")
        ),
      ok(paginate(MOCK_TEACHERS))
    )
      .then((r) => setTeachers(r.data?.items ?? []))
      .catch(() => setTeachers([]));
  };

  const submitAssign = async () => {
    if (!batch || !assignTeacherId || assigning) return;
    setAssigning(true);
    try {
      const teacher = teachers?.find((t) => t._id === assignTeacherId) ?? null;
      const r = await mockable(
        () =>
          api.patch<ApiResponse<{ batch: BatchDetail }>>(adminPath(`/batches/${batchId}`), {
            teacherId: assignTeacherId,
          }),
        ok({
          batch: {
            ...batch,
            teacher: teacher ? { _id: teacher._id, name: teacher.name } : batch.teacher,
            status: "active" as const,
          },
        })
      );
      if (r.data?.batch) setBatch(r.data.batch);
      setAssignOpen(false);
      toast.success("Teacher assigned — the batch is now active");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign the teacher");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <PageShell
      title={batch?.name ?? "Batch"}
      subtitle={batch ? `${batch.instrument?.name ?? ""} batch console` : "Loading batch…"}
      actions={
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push(`${base}/batches`)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          All batches
        </Button>
      }
    >
      {/* Identity chips */}
      {batch && (
        <BlurFade delay={0.05}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 font-semibold text-brand">
              <Music2 className="h-3 w-3" />
              {batch.instrument?.name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {batch.dayPattern?.label ?? "—"} · {batch.timeSlot?.label ?? "—"}
            </span>
            {batch.teacher ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                <User className="h-3 w-3" />
                {batch.teacher.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={openAssign}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand/60 px-2.5 py-1 font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                <User className="h-3 w-3" />
                Setting Phase — assign teacher
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground">
              <Users className="h-3 w-3" />
              {batch.studentCount} student{batch.studentCount === 1 ? "" : "s"}
            </span>
            <StatusBadge status={batch.status} />
          </div>
        </BlurFade>
      )}

      {/* Tab bar */}
      <BlurFade delay={0.1}>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1 sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all",
                tab === t
                  ? "bg-card text-brand shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </BlurFade>

      {/* ── OVERVIEW ── */}
      {tab === "Overview" && (
        <BlurFade delay={0.15}>
          <div className="space-y-6">
            {/* Launch session */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <BorderBeam size={60} duration={10} />
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                    <Video className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">Launch Session</h2>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ready for next broadcast
                    </p>
                  </div>
                </div>
                <div className="ml-auto w-36">
                  <Input
                    label="Target date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    placeholder="Enter Meeting URL… (Zoom, Meet, …)"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={launch}
                  disabled={launching}
                  className="rounded-full bg-foreground text-background hover:bg-foreground/85"
                >
                  {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Launch Class
                </Button>
              </div>
            </div>

            {/* Session archive */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Session Archive</h2>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sessions?.length ?? 0} logs total
                </span>
              </div>
              {!sessions ? (
                <TableSkeleton rows={3} />
              ) : sessions.length === 0 ? (
                <EmptyState
                  icon={Video}
                  title="No sessions yet"
                  hint="Launch your first class above — every session lands in this archive."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sessions.map((s) => (
                    <div
                      key={s._id}
                      className="relative overflow-hidden rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          Over
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(s.launchedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Manifest link
                      </p>
                      <a
                        href={s.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-brand hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.meetingUrl}</span>
                      </a>
                      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
                        <span className="font-semibold">{formatDate(s.targetDate)}</span>
                        <span className="font-semibold text-brand">Verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </BlurFade>
      )}

      {/* ── HOLIDAY ── */}
      {tab === "Holiday" && (
        <BlurFade delay={0.15}>
          <div className="relative max-w-3xl overflow-hidden rounded-xl border border-border bg-card p-5">
            <BorderBeam size={50} duration={12} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Holidays for this batch</h2>
                <p className="text-xs text-muted-foreground">
                  Declared holidays credit one class back to the matching students and appear on
                  the teacher and student panels.
                </p>
              </div>
              <Button variant="brand" size="sm" className="group rounded-full" onClick={() => setHolidayModal(true)}>
                Declare
                <Plus className="ml-1 h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            </div>
            <div className="mt-4">
              {!holidays ? (
                <Skeleton className="h-24 w-full" />
              ) : holidays.length === 0 ? (
                <EmptyState
                  icon={CalendarOff}
                  title="No holidays declared"
                  hint="Declare one for festivals, teacher leave or studio maintenance."
                />
              ) : (
                <ul className="divide-y divide-border/50">
                  {holidays.map((h) => (
                    <li key={h._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {formatDate(h.date)}
                          {h.reason && <span className="text-muted-foreground"> · {h.reason}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          {h.studentCategory}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete holiday"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingHoliday(h)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </BlurFade>
      )}

      {/* ── ATTENDANCE ── */}
      {tab === "Attendance" && (
        <BlurFade delay={0.15}>
          <div className="relative max-w-4xl overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={50} duration={12} />
            <div className="flex items-center justify-between border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Class-by-class attendance
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {classes?.length ?? 0} classes recorded
              </span>
            </div>
            {!classes ? (
              <div className="p-5">
                <TableSkeleton rows={4} />
              </div>
            ) : classes.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={ClipboardCheck}
                  title="No attendance marked yet"
                  hint="Once the teacher marks a class, its roll-up shows here."
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-brand">
                    <th className="px-5 py-2.5">Class date</th>
                    <th className="px-2 py-2.5">Marked</th>
                    <th className="px-2 py-2.5">Present</th>
                    <th className="px-2 py-2.5">Absent</th>
                    <th className="px-5 py-2.5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.date} className="border-b border-border/50">
                      <td className="px-5 py-2.5 font-medium">{formatDate(c.date)}</td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">{c.total} students</td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                          {c.present} present
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          {c.absent} absent
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => viewAttendance(c.date)}>
                          <Eye className="mr-1 h-3 w-3" />
                          View attendance
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </BlurFade>
      )}

      {/* ── STUDENTS ── */}
      {tab === "Students" && (
        <BlurFade delay={0.15}>
          <div className="relative max-w-4xl overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={50} duration={12} />
            {!roster ? (
              <div className="p-5">
                <TableSkeleton rows={4} />
              </div>
            ) : roster.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Users}
                  title="No students in this batch"
                  hint="Assign students from the Students tab or approve a request into this batch."
                />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-brand">
                    <th className="px-5 py-2.5">Student</th>
                    <th className="px-2 py-2.5">Mobile</th>
                    <th className="px-2 py-2.5">Status</th>
                    <th className="px-2 py-2.5">Category</th>
                    <th className="px-2 py-2.5">Validity</th>
                    <th className="px-5 py-2.5 text-right">Paid classes</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s._id} className="border-b border-border/50">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{s.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{s.displayId}</p>
                      </td>
                      <td className="px-2 py-2.5 text-xs">{formatPhone(s.mobile)}</td>
                      <td className="px-2 py-2.5"><StatusBadge status={s.joinStatus} /></td>
                      <td className="px-2 py-2.5 text-xs capitalize">{s.category}</td>
                      <td className="px-2 py-2.5 text-xs">{s.validityEnd ? formatDate(s.validityEnd) : "—"}</td>
                      <td className="px-5 py-2.5 text-right font-medium">{s.paidClasses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </BlurFade>
      )}

      {/* Declare holiday (scoped to this batch) */}
      <DeclareHolidayModal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        fixedBatchId={batchId}
        fixedBatchName={batch?.name}
        onDeclared={(created) => setHolidays((prev) => [...created, ...(prev ?? [])])}
      />

      {/* Delete holiday confirm */}
      <ConfirmModal
        open={!!deletingHoliday}
        onClose={() => setDeletingHoliday(null)}
        title="Remove holiday"
        message={
          deletingHoliday
            ? `Remove the holiday on ${formatDate(deletingHoliday.date)}? The credited class is taken back from the affected students.`
            : undefined
        }
        confirmLabel="Remove Holiday"
        destructive
        onConfirm={deleteHoliday}
      />

      {/* Per-date attendance detail — toggle any student present/absent */}
      <Modal
        open={!!viewingDate}
        onClose={() => {
          setViewingDate(null);
          setDayGrid(null);
        }}
        title="Attendance detail"
        subtitle={
          viewingDate
            ? `${formatDate(viewingDate)} · toggle to correct any wrongly marked student`
            : undefined
        }
      >
        {!dayGrid ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {dayGrid.rows.map((row) => {
              const mark = viewingDate ? markFor(row.marks, viewingDate) : "unmarked";
              const isPresent = mark === "present";
              return (
                <li
                  key={row.student._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.student.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.student.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {row.student.displayId}
                        {(mark === "holiday" || mark === "credited" || mark === "unmarked") && (
                          <span className="ml-2 rounded-full bg-amber-400/10 px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider text-amber-500">
                            {mark}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isPresent ? "text-emerald-500" : "text-muted-foreground"
                      )}
                    >
                      {isPresent ? "Present" : mark === "absent" ? "Absent" : "Mark"}
                    </span>
                    <Toggle
                      checked={isPresent}
                      tone="success"
                      onChange={(next) => setMark(row.student._id, next ? "present" : "absent")}
                      label={`Mark ${row.student.name} ${isPresent ? "absent" : "present"}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Assign teacher — flips a setting-phase batch to active */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign teacher"
        subtitle="Assigning a teacher moves this batch out of Setting Phase and makes it active."
      >
        <div className="space-y-4">
          <Select
            label="Teacher"
            required
            placeholder={teachers === null ? "Loading teachers…" : "Select teacher"}
            options={(teachers ?? [])
              .filter((t) => t.status === "active")
              .map((t) => ({ value: t._id, label: t.name }))}
            value={assignTeacherId}
            onChange={(v) => setAssignTeacherId(v)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              className="rounded-full"
              disabled={!assignTeacherId || assigning}
              onClick={submitAssign}
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
              Assign Teacher
            </Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
