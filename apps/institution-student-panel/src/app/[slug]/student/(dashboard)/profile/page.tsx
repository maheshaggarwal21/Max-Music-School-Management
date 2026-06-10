"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Music, Save, ShieldCheck, Users } from "lucide-react";
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
  type StatusBadgeStatus,
} from "@maxmusic/ui";
import { formatDate, formatPhone, joinStatusLabel } from "@maxmusic/utils";

import { api, mockable, studentPath } from "@/lib/api";
import { MOCK_PROFILE_EXTRAS, type StudentProfileExtras } from "@/lib/mocks";
import type { ApiResponse } from "@/lib/types";
import { useStudent } from "@/components/student-provider";

const JOIN_BADGES: ReadonlyArray<string> = ["trial", "active_soon", "active", "inactive"];

export default function ProfilePage() {
  const { student } = useStudent();
  // PENDING CONTRACT — batch/guardian/email extras are mock-only until Dev A
  // extends StudentSelf (or /me) in CONTRACTS.md.
  const [extras, setExtras] = useState<StudentProfileExtras | null>(null);
  const [email, setEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianMobile, setGuardianMobile] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable<StudentProfileExtras | null>(
      () => Promise.resolve(null),
      MOCK_PROFILE_EXTRAS
    ).then((e) => {
      if (cancelled || !e) return;
      setExtras(e);
      setEmail(e.email ?? "");
      setGuardianName(e.guardianName ?? "");
      setGuardianMobile(e.guardianMobile ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // PATCH /api/inst/:slug/student/me — "limited profile fields" per CONTRACTS.md
      await mockable(
        () =>
          api.patch<ApiResponse>(studentPath("/me"), {
            email,
            guardianName,
            guardianMobile,
          }),
        { success: true, message: "Profile updated", data: null } as ApiResponse,
        600
      );
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  if (!student) return null;

  const joinBadge: StatusBadgeStatus | null = JOIN_BADGES.includes(student.joinStatus)
    ? (student.joinStatus as StatusBadgeStatus)
    : null;

  const facts = [
    { icon: Music, label: "Instrument", value: student.instrument ?? "—" },
    { icon: CalendarClock, label: "Batch", value: extras?.batchName ?? "—" },
    {
      icon: CalendarClock,
      label: "Schedule",
      value:
        extras?.schedule && extras?.sessionSlot
          ? `${extras.schedule} · ${extras.sessionSlot}`
          : extras?.schedule ?? "—",
    },
    {
      icon: Users,
      label: "Guardian",
      value: extras?.guardianName
        ? `${extras.guardianName} · ${formatPhone(extras.guardianMobile)}`
        : "—",
    },
    {
      icon: ShieldCheck,
      label: "Valid until",
      value: student.validityEnd ? formatDate(student.validityEnd) : "—",
    },
  ];

  return (
    <div className="relative flex flex-col gap-6 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      <BlurFade delay={0}>
        <div>
          <GradientText className="text-2xl font-bold">Profile</GradientText>
          <ShinyText
            text="Your details and contact information"
            speed={6}
            className="mt-1 text-sm"
          />
        </div>
      </BlurFade>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identity card */}
        <BlurFade delay={0.1} className="h-full">
          <SpotlightCard className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6">
            <BorderBeam size={50} duration={10} />
            <div className="flex items-center gap-4">
              <Avatar name={student.name} size="lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{student.name}</h2>
                  {joinBadge && <StatusBadge status={joinBadge} />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Student ID{" "}
                  <span className="font-mono font-semibold text-brand">
                    {student.displayId}
                  </span>
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-3.5">
              {facts.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className="rounded-lg bg-brand/10 p-2">
                      <Icon className="h-3.5 w-3.5 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="truncate text-sm font-medium">{f.value}</dd>
                    </div>
                  </div>
                );
              })}
              {joinBadge && (
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-brand/10 p-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </dt>
                    <dd className="text-sm font-medium">
                      {joinStatusLabel(student.joinStatus)}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </SpotlightCard>
        </BlurFade>

        {/* Editable contact form */}
        <BlurFade delay={0.2} className="h-full">
          <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6">
            <BorderBeam size={50} duration={10} delay={2} />
            <h2 className="text-sm font-semibold">Contact details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep these up to date so your school can reach you.
            </p>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <Input
                label="Mobile number"
                value={formatPhone(student.mobile)}
                disabled
                readOnly
              />
              <p className="-mt-2 text-[11px] text-muted-foreground">
                Your mobile number is your sign-in ID — ask your school to change it.
              </p>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Guardian name"
                placeholder="Parent or guardian's name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
              <Input
                label="Guardian mobile"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={guardianMobile}
                onChange={(e) => setGuardianMobile(e.target.value)}
              />
              <Button
                variant="brand"
                type="submit"
                disabled={saving}
                className="group w-full rounded-full"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Save changes
                    <Save className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
