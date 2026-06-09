"use client";
// Profile — TeacherSelf card: instruments (derived from my batches),
// panelAccess as read-only badges, contact info edit form.

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Music2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  BlurFade,
  BorderBeam,
  Button,
  GradientText,
  Input,
  ShinyText,
  SpotlightCard,
  StatusBadge,
} from "@maxmusic/ui";
import { isValidEmail, isValidPhone } from "@maxmusic/utils";
import { api, mockable, teacherPath } from "@/lib/api";
import {
  MOCK_BATCHES_RESPONSE,
  MOCK_ME,
  MOCK_OK,
  MOCK_PANEL_ACCESS,
} from "@/lib/mocks";
import type { ApiResponse, BatchRow, TeacherMeData, TeacherSelf } from "@/lib/types";
import { CardListSkeleton } from "@/components/skeletons";

export default function ProfilePage() {
  const [teacher, setTeacher] = useState<TeacherSelf | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<{ email?: string; mobile?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<TeacherMeData>>(teacherPath("/me")),
      MOCK_ME
    ).then((res) => {
      if (cancelled || !res.data) return;
      setTeacher(res.data.teacher);
      setEmail(res.data.teacher.email);
      setMobile(res.data.teacher.mobile);
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

  const instruments = useMemo(() => {
    const names = new Set<string>();
    for (const b of batches) {
      if (b.instrument?.name) names.add(b.instrument.name);
    }
    return [...names].sort();
  }, [batches]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = "Enter a valid email address";
    if (!isValidPhone(mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      // NOTE: a teacher PATCH /me is not yet in CONTRACTS.md (students have one)
      // — flagged to Dev A; wired here so the form is ready at H5.
      await mockable(
        () => api.patch<ApiResponse<null>>(teacherPath("/me"), { email, mobile }),
        MOCK_OK,
        500
      );
      setTeacher((t) => (t ? { ...t, email, mobile } : t));
      toast.success("Contact details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="!mx-0 !justify-start text-2xl font-bold">
            Profile
          </GradientText>
          <ShinyText text="Your teaching identity at this school" speed={6} className="mt-1 text-sm" />
        </div>
      </BlurFade>

      {teacher === null ? (
        <CardListSkeleton count={2} />
      ) : (
        <>
          {/* Identity card */}
          <BlurFade delay={0.1}>
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6">
              <BorderBeam size={60} duration={8} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar name={teacher.name} size="lg" />
                  <div>
                    <p className="text-lg font-semibold">{teacher.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {teacher.displayId} · {teacher.activeBatches} active{" "}
                      {teacher.activeBatches === 1 ? "batch" : "batches"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={teacher.status} />
              </div>

              {/* Instruments */}
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Instruments
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {instruments.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Derived from your batches — none assigned yet
                    </span>
                  ) : (
                    instruments.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand"
                      >
                        <Music2 className="h-3 w-3" />
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Panel access — read-only */}
              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Panel access
                  <span className="font-normal normal-case tracking-normal">
                    (managed by your school)
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MOCK_PANEL_ACCESS.map((panel) => (
                    <span
                      key={panel}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      {panel === "admin" ? "Admin panel" : "Teacher panel"}
                    </span>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </BlurFade>

          {/* Contact info edit */}
          <BlurFade delay={0.2}>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 md:p-6">
              <BorderBeam size={40} duration={12} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Contact information
              </h2>
              <form onSubmit={save} className="mt-4 flex flex-col gap-4" noValidate>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    className="h-11"
                    required
                  />
                  <Input
                    label="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    error={errors.mobile}
                    className="h-11"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="brand"
                    disabled={saving}
                    className="h-11 rounded-full px-8"
                  >
                    {saving ? "Saving…" : "Save changes"}
                    <Save className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </BlurFade>
        </>
      )}
    </div>
  );
}
