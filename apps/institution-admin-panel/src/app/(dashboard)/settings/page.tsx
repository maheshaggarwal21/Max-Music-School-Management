"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays, CalendarOff, Clock, Loader2, Palette, Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, Button, DatePicker, Input, Modal, Select, cn, useBranding,
} from "@maxmusic/ui";
import { formatDate } from "@maxmusic/utils";
import { api, adminPath, mockable } from "@/lib/api";
import {
  MOCK_BATCHES, MOCK_DAY_PATTERNS, MOCK_HOLIDAYS, MOCK_TIME_SLOTS, ok,
} from "@/lib/mocks";
import type {
  ApiResponse, DayPatternItem, HolidayItem, TimeSlotItem,
} from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";
import { Toggle } from "@/components/toggle";

const ALL_DAYS = [
  { value: "mon", label: "Mon" }, { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" }, { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" }, { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${`${m ?? 0}`.padStart(2, "0")} ${suffix}`.replace(":00 ", ":00 ");
}

function SectionCard({
  title, subtitle, icon: Icon, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <BorderBeam size={50} duration={12} />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
          <Icon className="h-4 w-4 text-brand" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const branding = useBranding();

  const [dayPatterns, setDayPatterns] = useState<DayPatternItem[] | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlotItem[] | null>(null);
  const [holidays, setHolidays] = useState<HolidayItem[] | null>(null);

  // add-forms state
  const [newDays, setNewDays] = useState<string[]>([]);
  const [addingPattern, setAddingPattern] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

  const [holidayModal, setHolidayModal] = useState(false);
  const [holidayBatchId, setHolidayBatchId] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayCategory, setHolidayCategory] = useState<string | null>("regular");
  const [holidayReason, setHolidayReason] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<DayPatternItem[]>>(adminPath("/day-patterns")),
      ok(MOCK_DAY_PATTERNS)
    ).then((r) => !cancelled && setDayPatterns(r.data ?? []));
    mockable(
      () => api.get<ApiResponse<TimeSlotItem[]>>(adminPath("/time-slots")),
      ok(MOCK_TIME_SLOTS)
    ).then((r) => !cancelled && setTimeSlots(r.data ?? []));
    // NOTE: admin holiday endpoints are not in CONTRACTS.md yet (teacher panel
    // owns POST/DELETE /holidays) — flagged to the orchestrator; mock-only here.
    mockable(
      () => api.get<ApiResponse<HolidayItem[]>>(adminPath("/holidays")),
      ok(MOCK_HOLIDAYS)
    ).then((r) => !cancelled && setHolidays(r.data ?? []));
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePattern = async (p: DayPatternItem) => {
    setDayPatterns((prev) =>
      (prev ?? []).map((x) => (x._id === p._id ? { ...x, isActive: !x.isActive } : x))
    );
    await mockable(
      () => api.patch<ApiResponse>(adminPath(`/day-patterns/${p._id}`), { isActive: !p.isActive }),
      ok(null),
      250
    );
    toast.success(`${p.label} ${p.isActive ? "disabled" : "enabled"}`);
  };

  const addPattern = async () => {
    if (newDays.length === 0) return toast.error("Pick at least one day");
    setAddingPattern(true);
    try {
      await mockable(
        () => api.post<ApiResponse>(adminPath("/day-patterns"), { days: newDays }),
        ok(null),
        400
      );
      const ordered = ALL_DAYS.map((d) => d.value).filter((d) => newDays.includes(d));
      setDayPatterns((prev) => [
        ...(prev ?? []),
        {
          _id: `dp_local_${Date.now()}`,
          days: ordered,
          label: ordered.map((d) => DAY_LABEL[d]).join(" · "),
          isActive: true,
        },
      ]);
      setNewDays([]);
      toast.success("Day pattern added");
    } finally {
      setAddingPattern(false);
    }
  };

  const toggleSlot = async (t: TimeSlotItem) => {
    setTimeSlots((prev) =>
      (prev ?? []).map((x) => (x._id === t._id ? { ...x, isOnline: !x.isOnline } : x))
    );
    await mockable(
      () => api.patch<ApiResponse>(adminPath(`/time-slots/${t._id}`), { isOnline: !t.isOnline }),
      ok(null),
      250
    );
    toast.success(`${t.label} set to ${t.isOnline ? "offline" : "online"}`);
  };

  const addSlot = async () => {
    if (!newStart || !newEnd) return toast.error("Pick a start and end time");
    if (newEnd <= newStart) return toast.error("End time must be after start time");
    setAddingSlot(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse>(adminPath("/time-slots"), {
            startTime: newStart, endTime: newEnd,
          }),
        ok(null),
        400
      );
      setTimeSlots((prev) => [
        ...(prev ?? []),
        {
          _id: `ts_local_${Date.now()}`,
          startTime: newStart, endTime: newEnd,
          label: `${to12h(newStart)}-${to12h(newEnd)}`,
          isOnline: true,
        },
      ]);
      setNewStart("");
      setNewEnd("");
      toast.success("Time slot added");
    } finally {
      setAddingSlot(false);
    }
  };

  const addHoliday = async () => {
    if (!holidayBatchId) return toast.error("Select a batch");
    if (!holidayDate) return toast.error("Pick a date");
    setSavingHoliday(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse>(adminPath("/holidays"), {
            batchId: holidayBatchId,
            date: holidayDate,
            studentCategory: holidayCategory ?? "regular",
            reason: holidayReason || undefined,
          }),
        ok(null),
        400
      );
      const batch = MOCK_BATCHES.find((b) => b._id === holidayBatchId)!;
      setHolidays((prev) => [
        {
          _id: `hol_local_${Date.now()}`,
          batch: { _id: batch._id, name: batch.name },
          date: holidayDate,
          studentCategory: (holidayCategory ?? "regular") as "regular" | "trial",
          reason: holidayReason || null,
        },
        ...(prev ?? []),
      ]);
      toast.success("Holiday declared — affected students get a class credited");
      setHolidayModal(false);
      setHolidayBatchId(null);
      setHolidayDate(null);
      setHolidayReason("");
    } finally {
      setSavingHoliday(false);
    }
  };

  return (
    <PageShell title="Settings" subtitle="Day patterns, time slots, holidays and your school profile">
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Institution profile / branding preview */}
        <BlurFade delay={0.1}>
          <SectionCard
            title="School Profile"
            subtitle="How your brand appears across all panels"
            icon={Palette}
          >
            {!branding ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="flex items-start gap-4">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logoUrl}
                    alt={branding.schoolName}
                    className="h-16 w-16 rounded-2xl object-cover"
                  />
                ) : (
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    {branding.schoolName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w.charAt(0).toUpperCase())
                      .join("")}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">{branding.schoolName}</p>
                  {branding.tagline && (
                    <p className="text-sm text-muted-foreground">{branding.tagline}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      />
                      Brand color{" "}
                      <span className="font-mono uppercase">{branding.primaryColor}</span>
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 font-mono text-muted-foreground">
                      /{branding.slug}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Branding changes are managed by your platform administrator.
                  </p>
                </div>
              </div>
            )}
          </SectionCard>
        </BlurFade>

        {/* Day patterns */}
        <BlurFade delay={0.2}>
          <SectionCard
            title="Suitable Days"
            subtitle="Reusable day patterns that compose into batches"
            icon={CalendarDays}
          >
            {!dayPatterns ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {dayPatterns.map((p) => (
                    <span
                      key={p._id}
                      className={cn(
                        "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        p.isActive
                          ? "border-brand/30 bg-brand/5 text-foreground"
                          : "border-border bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {p.label}
                      <Toggle
                        checked={p.isActive}
                        onChange={() => togglePattern(p)}
                        label={`Toggle ${p.label}`}
                      />
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                  <div className="w-56">
                    <Select
                      label="New pattern"
                      multiple
                      placeholder="Pick days"
                      options={ALL_DAYS}
                      value={newDays}
                      onChange={setNewDays}
                    />
                  </div>
                  <Button
                    variant="brand"
                    size="sm"
                    className="group rounded-full"
                    onClick={addPattern}
                    disabled={addingPattern}
                  >
                    {addingPattern ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </BlurFade>

        {/* Time slots */}
        <BlurFade delay={0.3}>
          <SectionCard
            title="Suitable Times"
            subtitle="Reusable time windows — toggle online availability"
            icon={Clock}
          >
            {!timeSlots ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-4">
                <ul className="divide-y divide-border/50">
                  {timeSlots.map((t) => (
                    <li key={t._id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {t.startTime}–{t.endTime}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider",
                            t.isOnline ? "text-brand" : "text-muted-foreground"
                          )}
                        >
                          {t.isOnline ? "Online" : "Offline"}
                        </span>
                        <Toggle
                          checked={t.isOnline}
                          onChange={() => toggleSlot(t)}
                          label={`Toggle ${t.label}`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                  <div className="w-32">
                    <Input
                      label="Start"
                      type="time"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      label="End"
                      type="time"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="brand"
                    size="sm"
                    className="group rounded-full"
                    onClick={addSlot}
                    disabled={addingSlot}
                  >
                    {addingSlot ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </BlurFade>

        {/* Holidays */}
        <BlurFade delay={0.4}>
          <SectionCard
            title="Holidays"
            subtitle="Declared holidays credit a class back to students"
            icon={CalendarOff}
          >
            {!holidays ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-4">
                {holidays.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No holidays declared yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {holidays.map((h) => (
                      <li key={h._id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {formatDate(h.date)}
                            {h.reason && (
                              <span className="text-muted-foreground"> · {h.reason}</span>
                            )}
                          </p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {h.batch.name}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                          {h.studentCategory}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="brand"
                  size="sm"
                  className="group rounded-full"
                  onClick={() => setHolidayModal(true)}
                >
                  Declare Holiday
                  <Plus className="ml-1 h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
                </Button>
              </div>
            )}
          </SectionCard>
        </BlurFade>
      </div>

      {/* Add holiday modal */}
      <Modal
        open={holidayModal}
        onClose={() => setHolidayModal(false)}
        title="Declare Holiday"
        subtitle="Students in the batch get the class credited back"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHolidayModal(false)} disabled={savingHoliday}>
              Cancel
            </Button>
            <Button variant="brand" onClick={addHoliday} disabled={savingHoliday}>
              {savingHoliday && <Loader2 className="h-4 w-4 animate-spin" />}
              Declare Holiday
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Batch"
            required
            searchable
            placeholder="Select batch"
            options={MOCK_BATCHES.filter((b) => b.status === "active" || b.status === "setting").map(
              (b) => ({ value: b._id, label: b.name })
            )}
            value={holidayBatchId}
            onChange={setHolidayBatchId}
          />
          <DatePicker label="Date" required value={holidayDate} onChange={setHolidayDate} />
          <Select
            label="Student category"
            options={[
              { value: "regular", label: "Regular students" },
              { value: "trial", label: "Trial students" },
            ]}
            value={holidayCategory}
            onChange={setHolidayCategory}
          />
          <Input
            label="Reason"
            placeholder="e.g. Guru Purnima"
            value={holidayReason}
            onChange={(e) => setHolidayReason(e.target.value)}
          />
        </div>
      </Modal>
    </PageShell>
  );
}
