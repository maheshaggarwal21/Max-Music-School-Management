"use client";
// Batch detail — header card + student roster table.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Music2,
  Users,
} from "lucide-react";
import {
  Avatar,
  BlurFade,
  BorderBeam,
  Button,
  DataTable,
  GradientText,
  ShinyText,
  StatusBadge,
  type DataTableColumn,
} from "@maxmusic/ui";
import { formatDate, formatPhone, joinStatusLabel } from "@maxmusic/utils";
import { api, mockable, teacherPath } from "@/lib/api";
import { MOCK_BATCHES_RESPONSE, mockBatchStudentsResponse } from "@/lib/mocks";
import type { ApiResponse, BatchRow, StudentRow } from "@/lib/types";
import { CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

type RosterRow = StudentRow & Record<string, unknown>;

const columns: DataTableColumn<RosterRow>[] = [
  {
    key: "name",
    label: "Student",
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
  {
    key: "joinStatus",
    label: "Status",
    render: (s) => <StatusBadge status={s.joinStatus} />,
  },
  {
    key: "validityEnd",
    label: "Valid till",
    render: (s) =>
      s.validityEnd ? (
        formatDate(s.validityEnd)
      ) : (
        <span className="text-muted-foreground">{joinStatusLabel(s.joinStatus)}</span>
      ),
  },
];

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const batchId = params.id;

  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Batch header comes from the list endpoint (no GET /batches/:id in contract).
    mockable(
      () => api.get<ApiResponse<BatchRow[]>>(teacherPath("/batches")),
      MOCK_BATCHES_RESPONSE
    ).then((res) => {
      if (!cancelled) setBatches(res.data ?? []);
    });
    mockable(
      () =>
        api.get<ApiResponse<StudentRow[]>>(teacherPath(`/batches/${batchId}/students`)),
      mockBatchStudentsResponse(batchId)
    ).then((res) => {
      if (!cancelled) setStudents(res.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const batch = useMemo(
    () => batches?.find((b) => b._id === batchId) ?? null,
    [batches, batchId]
  );

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <Link
          href="/batches"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> My Batches
        </Link>
      </BlurFade>

      {/* Batch header card */}
      <BlurFade delay={0.1}>
        {batch === null && batches === null ? (
          <CardListSkeleton count={1} />
        ) : batch === null ? (
          <EmptyState
            icon={Music2}
            title="Batch not found"
            description="This batch may have been reassigned. Head back to My Batches."
          />
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6">
            <BorderBeam size={60} duration={8} />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                  <Music2 className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <GradientText className="!mx-0 !justify-start text-xl font-bold">
                    {batch.name}
                  </GradientText>
                  <ShinyText
                    text={`${batch.instrument?.name ?? "Instrument TBD"} · ${batch.studentCount} students`}
                    speed={6}
                    className="mt-0.5 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {batch.dayPattern?.label ?? "Days TBD"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {batch.timeSlot?.label ?? "Time TBD"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {batch.studentCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <StatusBadge status={batch.status} />
                <Button asChild variant="brand" size="sm" className="group rounded-full">
                  <Link href={`/attendance?batch=${batch._id}`}>
                    Mark attendance
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </BlurFade>

      {/* Roster */}
      <BlurFade delay={0.2}>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Student roster
          </h2>
          {students !== null && students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students in this batch yet"
              description="Students appear here once your admin assigns them to this batch."
            />
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
    </div>
  );
}
