"use client";
// Class Schedule Management — a colleague's batches as launchable rows. Pick a
// date + (optionally) a batch, then Launch Class (paste a meeting link → a
// ClassSession is created for that batch on that date). Every teacher may launch
// any colleague's class (institution-scoped). WHITE-LABEL: institution brand only.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock, Link2, Loader2, Radio } from "lucide-react";
import {
  BlurFade, BorderBeam, Button, DatePicker, Input, Modal, Select, cn,
} from "@maxmusic/ui";
import { api, mockable, teacherPath } from "@/lib/api";
import { mockColleagueSchedule, mockLaunchedSession } from "@/lib/mocks";
import type { ApiResponse, ColleagueSchedule, ScheduleRow, SessionRow } from "@/lib/types";
import { toIsoDate } from "@/lib/schedule";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

export default function ColleagueSchedulePage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const base = `/${slug}/teacher`;

  const [data, setData] = useState<ColleagueSchedule | null>(null);
  const [date, setDate] = useState<string>(() => toIsoDate(new Date()));
  const [batchFilter, setBatchFilter] = useState<string | null>("all");

  // Launch modal
  const [launchFor, setLaunchFor] = useState<ScheduleRow | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [launching, setLaunching] = useState(false);

  const load = useCallback(() => {
    mockable(
      () => api.get<ApiResponse<ColleagueSchedule>>(teacherPath(`/colleagues/${id}/schedule?date=${date}`)),
      mockColleagueSchedule(id, date)
    ).then((r) => setData(r.data ?? null));
  }, [id, date]);

  useEffect(() => { setData(null); load(); }, [load]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return batchFilter && batchFilter !== "all" ? all.filter((r) => r._id === batchFilter) : all;
  }, [data, batchFilter]);

  const launch = async () => {
    if (!launchFor || !meetingUrl.trim()) return;
    setLaunching(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<SessionRow>>(teacherPath(`/batches/${launchFor._id}/sessions`), {
            meetingUrl: meetingUrl.trim(),
            targetDate: date,
          }),
        mockLaunchedSession(meetingUrl.trim(), date)
      );
      toast.success(`Class launched for ${launchFor.name}`);
      setData((prev) =>
        prev ? { ...prev, rows: prev.rows.map((r) => (r._id === launchFor._id ? { ...r, launched: true } : r)) } : prev
      );
      setLaunchFor(null);
      setMeetingUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not launch class");
    } finally {
      setLaunching(false);
    }
  };

  const niceDate = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className="relative mx-auto w-full max-w-5xl p-4 md:p-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-4">
          <BorderBeam size={50} duration={10} />
          <div className="flex items-center gap-3">
            <Link
              href={`${base}/teachers`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold uppercase">{data?.teacher.name ?? "…"}</h1>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                Class Schedule Management
              </p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.05} className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-48">
            <DatePicker value={date} onChange={(v) => setDate(v ?? toIsoDate(new Date()))} />
          </div>
          <div className="w-full sm:w-56">
            <Select
              options={[
                { value: "all", label: "All Batches" },
                ...(data?.rows ?? []).map((r) => ({ value: r._id, label: r.name })),
              ]}
              value={batchFilter}
              onChange={setBatchFilter}
              searchable
            />
          </div>
        </div>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.1} className="mt-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[2fr_1.2fr_0.9fr_auto] items-center gap-3 border-b border-border bg-muted/30 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Batch Details</span>
            <span>Date &amp; Time</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>

          {data === null ? (
            <div className="p-5"><CardListSkeleton count={4} /></div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Clock} title="No batches" description="This teacher has no batches to schedule yet." />
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((r, i) => (
                <BlurFade key={r._id} delay={0.05 + i * 0.04} inView>
                  <li className="grid grid-cols-[2fr_1.2fr_0.9fr_auto] items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold uppercase">{r.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-brand">
                        {r.instrument?.name ?? "Faculty"} session
                      </p>
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="font-semibold tabular-nums">{niceDate}</p>
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {r.timeSlot?.label?.split("–")[0]?.trim() ?? r.timeSlot?.label ?? "—"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        r.launched
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.launched ? <Radio className="h-3 w-3" /> : null}
                      {r.launched ? "Launched" : "Closed"}
                    </span>
                    <div className="text-right">
                      <Button
                        variant={r.launched ? "ghost" : "brand"}
                        className="h-8 rounded-lg px-3 text-xs"
                        onClick={() => { setLaunchFor(r); setMeetingUrl(""); }}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {r.launched ? "Relaunch" : "Launch Class"}
                      </Button>
                    </div>
                  </li>
                </BlurFade>
              ))}
            </ul>
          )}
        </div>
      </BlurFade>

      {/* Launch modal */}
      <Modal
        open={!!launchFor}
        onClose={() => setLaunchFor(null)}
        title="Launch class"
        subtitle={launchFor ? `${launchFor.name} · ${niceDate}` : undefined}
      >
        <div className="space-y-4">
          <Input
            label="Meeting URL"
            required
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://zoom.us/j/…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLaunchFor(null)}>Cancel</Button>
            <Button variant="brand" onClick={launch} disabled={!meetingUrl.trim() || launching}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Launch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
