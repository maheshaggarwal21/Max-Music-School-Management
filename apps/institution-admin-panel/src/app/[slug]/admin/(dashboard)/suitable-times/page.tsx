"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Clock, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BorderBeam, Button, TimePicker, cn } from "@maxmusic/ui";
import { api, adminPath, mockable } from "@/lib/api";
import { MOCK_TIME_SLOTS, ok } from "@/lib/mocks";
import type { ApiResponse, TimeSlotItem } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";
import { Toggle } from "@/components/toggle";

// Suitable Times — dedicated console (pulled out of Settings).
// Wide "Registered Class Windows" list + narrow "New Window" register-slot
// card, themed with the institution's brand color.

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${`${m ?? 0}`.padStart(2, "0")} ${suffix}`;
}

function normalizeSlots(data: unknown): TimeSlotItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as TimeSlotItem[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.timeSlots)) return obj.timeSlots as TimeSlotItem[];
  if (Array.isArray(obj.items)) return obj.items as TimeSlotItem[];
  return [];
}

export default function SuitableTimesPage() {
  const [slots, setSlots] = useState<TimeSlotItem[] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<unknown>>(adminPath("/time-slots")),
      ok<unknown>(MOCK_TIME_SLOTS)
    ).then((r) => !cancelled && setSlots(normalizeSlots(r.data)));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (t: TimeSlotItem) => {
    setSlots((prev) =>
      (prev ?? []).map((x) => (x._id === t._id ? { ...x, isOnline: !x.isOnline } : x))
    );
    await mockable(
      () => api.patch<ApiResponse>(adminPath(`/time-slots/${t._id}`), { isOnline: !t.isOnline }),
      ok(null),
      250
    );
    toast.success(`${t.label} set to ${t.isOnline ? "offline" : "online"}`);
  };

  const openWindow = async () => {
    if (!start || !end) return toast.error("Pick a start and end time");
    if (end <= start) return toast.error("End time must be after start time");
    setCreating(true);
    try {
      await mockable(
        () => api.post<ApiResponse>(adminPath("/time-slots"), { startTime: start, endTime: end }),
        ok(null),
        400
      );
      setSlots((prev) => [
        ...(prev ?? []),
        {
          _id: `ts_local_${Date.now()}`,
          startTime: start,
          endTime: end,
          label: `${to12h(start)}-${to12h(end)}`,
          isOnline: true,
        },
      ]);
      setStart("");
      setEnd("");
      toast.success("Window registered — it is now selectable across the platform");
    } finally {
      setCreating(false);
    }
  };

  const onlineCount = (slots ?? []).filter((s) => s.isOnline).length;

  return (
    <PageShell title="Time Availability" subtitle="Configured class session windows">
      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Registered class windows */}
        <BlurFade delay={0.1} className="xl:col-span-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={60} duration={12} />
            <div className="flex items-center justify-between border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Clock className="h-3.5 w-3.5" />
                Registered Class Windows
              </h2>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Visibility &amp; Control
              </span>
            </div>

            {!slots ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : slots.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No class windows yet — register your first slot on the right.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {slots.map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                        <Clock className="h-3.5 w-3.5 text-brand" />
                      </span>
                      <p className="flex items-center gap-2 text-sm font-medium tabular-nums">
                        {to12h(t.startTime)}
                        <ArrowRight className="h-3 w-3 text-brand" />
                        {to12h(t.endTime)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          t.isOnline ? "text-brand" : "text-muted-foreground/60"
                        )}
                      >
                        {t.isOnline ? "Online" : "Offline"}
                      </span>
                      <Toggle checked={t.isOnline} onChange={() => toggle(t)} label={`Toggle ${t.label}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Slots: {slots?.length ?? 0}</span>
              <span>{onlineCount} online</span>
            </div>
          </div>
        </BlurFade>

        {/* New window — register slot */}
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <BorderBeam size={50} duration={10} />
            <div className="border-b border-border bg-brand/[0.06] px-5 py-3">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Plus className="h-3.5 w-3.5" />
                New Window
              </h2>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Register Slot
              </p>
            </div>
            <div className="space-y-3 p-5">
              <TimePicker
                label="Start time"
                value={start}
                onChange={setStart}
              />
              <TimePicker
                label="End time"
                value={end}
                onChange={setEnd}
              />
              <Button
                variant="brand"
                className="mt-1 w-full rounded-lg"
                onClick={openWindow}
                disabled={creating || !start || !end}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                Open Window
              </Button>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Windows define class start and end times. They will be displayed across the
                platform in AM/PM format.
              </p>
            </div>
          </div>
        </BlurFade>
      </div>
    </PageShell>
  );
}
