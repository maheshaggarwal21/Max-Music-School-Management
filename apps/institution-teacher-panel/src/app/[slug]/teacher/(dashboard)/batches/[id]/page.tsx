"use client";
// Batch detail — Overview (Launch Session + Session Archive) · Attendance · Students.
// Sessions are real ClassSession records (GET/POST /teacher/batches/:id/sessions).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, Clock, ExternalLink,
  Link2, Loader2, Music2, Radio, Users, Video,
} from "lucide-react";
import {
  Avatar, BlurFade, BorderBeam, Button, DataTable, DatePicker, GradientText,
  Input, ShinyText, StatusBadge, cn, type DataTableColumn,
} from "@maxmusic/ui";
import { formatDate, formatPhone, joinStatusLabel } from "@maxmusic/utils";
import { api, mockable, teacherPath } from "@/lib/api";
import {
  mockBatchInfoResponse, mockBatchStudentsResponse, mockLaunchedSession,
  mockSessionsResponse,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, Paginated, SessionRow, StudentRow,
} from "@/lib/types";
import { toIsoDate } from "@/lib/schedule";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

type Tab = "overview" | "attendance" | "students";
type RosterRow = StudentRow & Record<string, unknown>;

const columns: DataTableColumn<RosterRow>[] = [
  {
    key: "name", label: "Student",
    render: (s) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={s.name} size="sm" />
        <div>
          <p className="font-medium">{s.name}</p>
          <p className="text-[11px] text-muted-foreground">{s.displayId}</p>
        </div>
      </div>
    ),
  },
  { key: "mobile", label: "Mobile", render: (s) => formatPhone(s.mobile) },
  { key: "joinStatus", label: "Status", render: (s) => <StatusBadge status={s.joinStatus} /> },
  {
    key: "validityEnd", label: "Valid till",
    render: (s) => (s.validityEnd ? formatDate(s.validityEnd)
      : <span className="text-muted-foreground">{joinStatusLabel(s.joinStatus)}</span>),
  },
];

export default function BatchDetailPage() {
  const { slug, id: batchId } = useParams<{ slug: string; id: string }>();
  const base = `/${slug}/teacher`;

  const [tab, setTab] = useState<Tab>("overview");
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [batchLoaded, setBatchLoaded] = useState(false);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  // Launch form
  const [meetingUrl, setMeetingUrl] = useState("");
  const [targetDate, setTargetDate] = useState<string>(() => toIsoDate(new Date()));
  const [launching, setLaunching] = useState(false);

  const loadSessions = useCallback(() => {
    mockable(
      () => api.get<ApiResponse<Paginated<SessionRow>>>(teacherPath(`/batches/${batchId}/sessions`)),
      mockSessionsResponse(batchId)
    ).then((r) => setSessions(r.data?.items ?? []));
  }, [batchId]);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<BatchRow | null>>(teacherPath(`/batches/${batchId}`)),
      mockBatchInfoResponse(batchId)
    ).then((r) => { if (!cancelled) { setBatch(r.data ?? null); setBatchLoaded(true); } });
    mockable(
      () => api.get<ApiResponse<StudentRow[]>>(teacherPath(`/batches/${batchId}/students`)),
      mockBatchStudentsResponse(batchId)
    ).then((r) => { if (!cancelled) setStudents(r.data ?? []); });
    loadSessions();
    return () => { cancelled = true; };
  }, [batchId, loadSessions]);

  const launch = async () => {
    if (!meetingUrl.trim()) return toast.error("Paste a meeting URL");
    setLaunching(true);
    try {
      const res = await mockable(
        () => api.post<ApiResponse<SessionRow>>(teacherPath(`/batches/${batchId}/sessions`), {
          meetingUrl: meetingUrl.trim(), targetDate,
        }),
        mockLaunchedSession(meetingUrl.trim(), targetDate)
      );
      if (res.data) setSessions((prev) => [res.data as SessionRow, ...(prev ?? [])]);
      setMeetingUrl("");
      toast.success("Class launched");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not launch session");
    } finally {
      setLaunching(false);
    }
  };

  const TABS: { key: Tab; label: string; icon: typeof Video }[] = [
    { key: "overview", label: "Overview", icon: Video },
    { key: "attendance", label: "Attendance", icon: ClipboardCheck },
    { key: "students", label: "Students", icon: Users },
  ];

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      {/* Header + tabs */}
      <BlurFade delay={0}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-4">
          <BorderBeam size={60} duration={9} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`${base}/batches`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <Music2 className="h-5 w-5 text-brand" />
              </span>
              <div className="min-w-0">
                <GradientText className="!mx-0 !justify-start text-lg font-bold">
                  {batch?.name ?? (batchLoaded ? "Batch" : "…")}
                </GradientText>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand">
                  {batch?.instrument?.name ?? "—"}
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {batch?.timeSlot?.label?.split("–")[0]?.trim() ?? "—"}
                  </span>
                </p>
              </div>
            </div>
            {batch && <StatusBadge status={batch.status} />}
          </div>

          {/* Tabs */}
          <div className="mt-4 flex w-fit gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                  tab === t.key ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </BlurFade>

      {batchLoaded && batch === null ? (
        <EmptyState icon={Music2} title="Batch not found" description="This batch may have been reassigned." />
      ) : tab === "overview" ? (
        <>
          {/* Launch Session */}
          <BlurFade delay={0.05}>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-foreground/[0.02] p-5">
              <BorderBeam size={60} duration={10} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15">
                    <Video className="h-5 w-5 text-brand" />
                  </span>
                  <div>
                    <p className="text-base font-bold">Launch Session</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ready for next broadcast
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-40">
                  <DatePicker value={targetDate} onChange={(v) => setTargetDate(v ?? toIsoDate(new Date()))} />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="Enter meeting URL…"
                    className="pl-9"
                  />
                </div>
                <Button variant="brand" className="rounded-lg sm:w-44" onClick={launch} disabled={launching}>
                  {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  Launch Class
                </Button>
              </div>
            </div>
          </BlurFade>

          {/* Session Archive */}
          <BlurFade delay={0.1}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-4 w-4" /> Session Archive
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sessions?.length ?? 0} logs total
                </span>
              </div>

              {sessions === null ? (
                <CardListSkeleton count={3} />
              ) : sessions.length === 0 ? (
                <EmptyState icon={Video} title="No sessions launched yet" description="Launch your first class above — it will appear here." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sessions.map((s, i) => (
                    <BlurFade key={s._id} delay={0.05 + i * 0.04} inView>
                      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            Over
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            #{`${1000 + i}`}
                          </span>
                        </div>
                        <p className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Manifest Link
                        </p>
                        <a
                          href={s.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-brand hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{s.meetingUrl.replace(/^https?:\/\//, "")}</span>
                        </a>
                        <div className="mt-3 flex items-end justify-between">
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Execution on
                            </p>
                            <p className="text-xs font-bold tabular-nums">{formatDate(s.targetDate)}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        </div>
                      </div>
                    </BlurFade>
                  ))}
                </div>
              )}
            </div>
          </BlurFade>
        </>
      ) : tab === "attendance" ? (
        <BlurFade delay={0.05}>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center">
            <BorderBeam size={50} duration={10} />
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
              <ClipboardCheck className="h-6 w-6 text-brand" />
            </span>
            <p className="mt-3 text-sm font-semibold">Mark attendance for this batch</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Open the attendance console to mark today&apos;s class for {batch?.name ?? "this batch"}.
            </p>
            <Button asChild variant="brand" className="mt-4 rounded-full">
              <Link href={`${base}/attendance?batch=${batchId}`}>
                Open attendance console
              </Link>
            </Button>
          </div>
        </BlurFade>
      ) : (
        <BlurFade delay={0.05}>
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" /> Student roster
            </h2>
            {students !== null && students.length === 0 ? (
              <EmptyState icon={Users} title="No students in this batch yet"
                description="Students appear here once your admin assigns them to this batch." />
            ) : (
              <DataTable<RosterRow>
                columns={columns}
                data={(students ?? []) as RosterRow[]}
                loading={students === null}
                emptyMessage="No students in this batch"
              />
            )}
          </div>
        </BlurFade>
      )}
    </div>
  );
}
