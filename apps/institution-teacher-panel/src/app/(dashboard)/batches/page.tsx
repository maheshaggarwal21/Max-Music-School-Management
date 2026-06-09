"use client";
// My Batches — tap a card for the student roster.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Music2, Users } from "lucide-react";
import {
  BlurFade,
  BorderBeam,
  GradientText,
  ShinyText,
  SpotlightCard,
  StatusBadge,
} from "@maxmusic/ui";
import { api, mockable, teacherPath } from "@/lib/api";
import { MOCK_BATCHES_RESPONSE } from "@/lib/mocks";
import type { ApiResponse, BatchRow } from "@/lib/types";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
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

  const totalStudents = useMemo(
    () => (batches ?? []).reduce((s, b) => s + b.studentCount, 0),
    [batches]
  );

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="!mx-0 !justify-start text-2xl font-bold">
            My Batches
          </GradientText>
          <ShinyText
            text={
              batches
                ? `${batches.length} batches · ${totalStudents} students`
                : "Loading your batches…"
            }
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        {batches === null ? (
          <CardListSkeleton count={4} />
        ) : batches.length === 0 ? (
          <EmptyState
            icon={Music2}
            title="No batches assigned yet"
            description="Your school admin will assign batches to you. They will appear here the moment that happens."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {batches.map((b, i) => (
              <BlurFade key={b._id} delay={0.15 + i * 0.08} inView>
                <Link href={`/batches/${b._id}`} className="block">
                  <SpotlightCard className="relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1">
                    <BorderBeam size={40} duration={12} delay={i * 1.5} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                            <Music2 className="h-4 w-4 text-brand" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{b.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {b.instrument?.name ?? "Instrument TBD"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {b.dayPattern?.label ?? "Days TBD"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {b.timeSlot?.label ?? "Time TBD"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {b.studentCount} {b.studentCount === 1 ? "student" : "students"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={b.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </SpotlightCard>
                </Link>
              </BlurFade>
            ))}
          </div>
        )}
      </BlurFade>
    </div>
  );
}
