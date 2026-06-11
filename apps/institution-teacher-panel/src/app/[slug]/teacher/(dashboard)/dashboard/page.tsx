"use client";
// Teacher dashboard — YOUR BATCHES (searchable, day-filtered) on the left,
// the teacher's profile card + holidays console on the right. Holidays live
// here now (no standalone tab). WHITE-LABEL: institution brand only.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarDays, ChevronRight, Clock, Mail, Phone, Plus, Search, Music2,
  CalendarOff, Hash, Trash2, Loader2,
} from "lucide-react";
import {
  Avatar, BlurFade, BorderBeam, Button, DatePicker, GradientText, Input,
  Modal, Select, cn,
} from "@maxmusic/ui";
import { formatDate } from "@maxmusic/utils";
import { api, mockable, teacherPath } from "@/lib/api";
import {
  MOCK_BATCHES_RESPONSE, MOCK_INSTITUTION_HOLIDAYS_RESPONSE, MOCK_ME, MOCK_OK,
  mockCreatedHoliday,
} from "@/lib/mocks";
import type {
  ApiResponse, BatchRow, HolidayItem, TeacherSelf, TeacherMeData,
} from "@/lib/types";
import { batchMeetsOn, parseStartMinutes } from "@/lib/schedule";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

const DAY_OPTIONS = [
  { value: "all", label: "All days" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export default function DashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/teacher`;

  const [teacher, setTeacher] = useState<TeacherSelf | null>(null);
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [holidays, setHolidays] = useState<HolidayItem[] | null>(null);

  const [query, setQuery] = useState("");
  const [day, setDay] = useState<string | null>("all");

  // Add-holiday modal
  const [open, setOpen] = useState(false);
  const [hBatch, setHBatch] = useState<string | null>(null);
  const [hDate, setHDate] = useState<string | null>(null);
  const [hCategory, setHCategory] = useState<string | null>("regular");
  const [hReason, setHReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(() => api.get<ApiResponse<TeacherMeData>>(teacherPath("/me")), MOCK_ME)
      .then((r) => !cancelled && r.data && setTeacher(r.data.teacher));
    mockable(() => api.get<ApiResponse<BatchRow[]>>(teacherPath("/batches")), MOCK_BATCHES_RESPONSE)
      .then((r) => !cancelled && setBatches(r.data ?? []));
    mockable(
      () => api.get<ApiResponse<HolidayItem[]>>(teacherPath("/holidays")),
      MOCK_INSTITUTION_HOLIDAYS_RESPONSE
    ).then((r) => !cancelled && setHolidays(r.data ?? []));
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = batches ?? [];
    if (day && day !== "all") {
      const d = Number(day);
      list = list.filter((b) => batchMeetsOn(b, nextDateForDay(d)));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.instrument?.name ?? "").toLowerCase().includes(q) ||
          (b.timeSlot?.label ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => parseStartMinutes(a.timeSlot?.label) - parseStartMinutes(b.timeSlot?.label)
    );
  }, [batches, query, day]);

  const submitHoliday = async () => {
    if (!hBatch || !hDate || !hCategory) return;
    setSaving(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<HolidayItem>>(teacherPath("/holidays"), {
            batchId: hBatch, date: hDate, studentCategory: hCategory, reason: hReason || undefined,
          }),
        mockCreatedHoliday(hBatch, hDate, hCategory as "regular" | "trial", hReason)
      );
      if (res.data) setHolidays((prev) => [res.data as HolidayItem, ...(prev ?? [])]);
      setOpen(false);
      setHBatch(null); setHDate(null); setHCategory("regular"); setHReason("");
    } finally {
      setSaving(false);
    }
  };

  const removeHoliday = async (id: string) => {
    setHolidays((prev) => (prev ?? []).filter((h) => h._id !== id));
    await mockable(() => api.delete<ApiResponse<null>>(teacherPath(`/holidays/${id}`)), MOCK_OK);
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── YOUR BATCHES ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <BlurFade delay={0}>
            <GradientText className="!mx-0 !justify-start text-2xl font-bold">
              Your Batches
            </GradientText>
          </BlurFade>

          {/* Search + day filter + count */}
          <BlurFade delay={0.05}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search batches, instruments, times…"
                  className="pl-9"
                />
              </div>
              <div className="w-44">
                <Select options={DAY_OPTIONS} value={day} onChange={setDay} />
              </div>
              <span className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold tabular-nums text-muted-foreground">
                {filtered.length} / {batches?.length ?? 0}
              </span>
            </div>
          </BlurFade>

          {/* Batch cards */}
          {batches === null ? (
            <CardListSkeleton count={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Music2}
              title={batches.length === 0 ? "No batches assigned yet" : "No batches match"}
              description={
                batches.length === 0
                  ? "Your school admin will assign batches to you. They appear here instantly."
                  : "Try a different day or clear your search."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((b, i) => (
                <BlurFade key={b._id} delay={0.1 + i * 0.05} inView>
                  <Link href={`${base}/batches/${b._id}`} className="block">
                    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40">
                      <BorderBeam size={40} duration={12} delay={i * 1.5} />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-base font-bold text-brand">
                            {(b.instrument?.name ?? b.name).charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {b.name}
                              <span
                                className={cn(
                                  "ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  b.status === "active"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {b.status === "active" ? "On" : b.status}
                              </span>
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5 text-brand" />
                                {b.dayPattern?.label ?? "Days TBD"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-brand" />
                                {b.timeSlot?.label ?? "Time TBD"}
                              </span>
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </BlurFade>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: profile + holidays ──────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Profile card */}
          <BlurFade delay={0.1}>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <BorderBeam size={50} duration={10} />
              {/* Branded header band */}
              <div className="bg-gradient-to-br from-brand/10 via-brand/[0.06] to-transparent px-5 pb-5 pt-6">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 rounded-full ring-2 ring-brand/25 ring-offset-2 ring-offset-card">
                    <Avatar name={teacher?.name ?? "Teacher"} size="lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold leading-tight tracking-tight">{teacher?.name ?? "…"}</p>
                    <span
                      className={cn(
                        "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        teacher?.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {teacher?.status === "active" ? "Active Teacher" : teacher?.status ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-0.5 border-t border-border/60 p-3">
                <InfoRow icon={Hash} label="Reg. No" value={teacher?.displayId ?? "—"} />
                <InfoRow icon={Mail} label="Email" value={teacher?.email ?? "—"} />
                <InfoRow icon={Phone} label="Contact" value={teacher?.mobile ?? "—"} />
              </div>
            </div>
          </BlurFade>

          {/* Holidays card */}
          <BlurFade delay={0.15}>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <BorderBeam size={50} duration={11} />
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                  <CalendarOff className="h-3.5 w-3.5" /> Holidays
                </h2>
                <Button
                  variant="brand"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Holiday
                </Button>
              </div>

              {holidays === null ? (
                <div className="p-5"><CardListSkeleton count={2} /></div>
              ) : holidays.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No holidays declared yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {holidays.slice(0, 6).map((h) => (
                    <li key={h._id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <span className="text-[9px] font-bold uppercase leading-none">
                          {new Date(`${String(h.date).slice(0, 10)}T00:00:00`).toLocaleString("en-US", { month: "short" })}
                        </span>
                        <span className="text-sm font-bold leading-tight">
                          {new Date(`${String(h.date).slice(0, 10)}T00:00:00`).getDate()}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold uppercase tracking-wide">
                          Teacher on Holiday
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {h.batch.name} · {h.studentCategory}
                          {h.reason ? ` · ${h.reason}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove holiday"
                        onClick={() => removeHoliday(h._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </BlurFade>
        </div>
      </div>

      {/* Add holiday modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Declare a holiday">
        <div className="space-y-4">
          <Select
            label="Batch"
            required
            options={(batches ?? []).map((b) => ({ value: b._id, label: `${b.name} · ${b.instrument?.name ?? ""}` }))}
            value={hBatch}
            onChange={setHBatch}
            searchable
          />
          <DatePicker label="Date" required value={hDate} onChange={setHDate} />
          <Select
            label="Student category"
            required
            options={[
              { value: "regular", label: "Regular students" },
              { value: "trial", label: "Trial students" },
            ]}
            value={hCategory}
            onChange={setHCategory}
          />
          <Input
            label="Reason (optional)"
            value={hReason}
            onChange={(e) => setHReason(e.target.value)}
            placeholder="e.g. Festival break"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={submitHoliday} disabled={!hBatch || !hDate || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Declare holiday
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/15 transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

// Nearest upcoming date that falls on weekday `d` (0=Sun..6=Sat), today included.
function nextDateForDay(d: number): Date {
  const now = new Date();
  const delta = (d - now.getDay() + 7) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
}
