"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { LifeBuoy, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { BlurFade, BorderBeam, GradientText, ShinyText, SpotlightCard } from "@maxmusic/ui";
import { formatPhone } from "@maxmusic/utils";

import { api, mockable, studentPath } from "@/lib/api";
import { MOCK_CONTACT } from "@/lib/mocks";
import type { ApiResponse, ContactInfo } from "@/lib/types";
import { useStudent } from "@/components/student-provider";

/** Normalise an Indian mobile to international digits (for tel: / wa.me). */
function intlDigits(mobile: string): string {
  const d = mobile.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

function ActionCircle({
  href,
  label,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "green";
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="group flex flex-col items-center gap-2"
    >
      <span
        className={
          "flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 " +
          (tone === "brand"
            ? "bg-brand/10 text-brand"
            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </a>
  );
}

export default function ContactPage() {
  const { student, branding } = useStudent();
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<ContactInfo>>(studentPath("/contact")).then((r) => r.data!),
      MOCK_CONTACT
    )
      .then((c) => {
        if (!cancelled) setContact(c);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = student?.name.split(" ")[0];
  const teacher = contact?.teacher ?? null;
  const support = contact?.support ?? null;

  return (
    <div className="relative flex flex-col gap-8 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full opacity-[0.04] blur-[100px]"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
      </div>

      {/* Hero */}
      <BlurFade delay={0}>
        <div className="mx-auto max-w-xl text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-brand">
            <LifeBuoy className="h-3.5 w-3.5" />
            Help Center
          </p>
          <GradientText className="mt-2 block text-3xl font-bold md:text-4xl">
            Please get in touch
          </GradientText>
          <ShinyText
            text={
              firstName
                ? `Hello ${firstName}, how can we help you today? We're always here to support your musical journey.`
                : "How can we help you today?"
            }
            speed={6}
            className="mt-3 text-sm"
          />
        </div>
      </BlurFade>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-2">
          {/* Teacher */}
          <BlurFade delay={0.12} className="h-full">
            <SpotlightCard className="relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-8 text-center">
              <BorderBeam size={50} duration={10} />
              <h2 className="text-base font-bold uppercase tracking-wide">Contact your teacher</h2>
              {teacher ? (
                <>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {teacher.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPhone(teacher.mobile)}
                  </p>
                  <div className="mt-6 flex items-center gap-8">
                    <ActionCircle
                      href={`tel:+${intlDigits(teacher.mobile)}`}
                      label="Call"
                      icon={Phone}
                      tone="brand"
                    />
                    <ActionCircle
                      href={`https://wa.me/${intlDigits(teacher.mobile)}`}
                      label="Chat"
                      icon={MessageCircle}
                      tone="green"
                    />
                  </div>
                </>
              ) : (
                <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                  You&apos;ll be able to reach your teacher here once you&apos;re assigned to a
                  batch. In the meantime, our support team is happy to help.
                </p>
              )}
            </SpotlightCard>
          </BlurFade>

          {/* Support */}
          <BlurFade delay={0.2} className="h-full">
            <SpotlightCard className="relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-8 text-center">
              <BorderBeam size={50} duration={10} delay={2} />
              <h2 className="text-base font-bold uppercase tracking-wide">
                {support?.schoolName ?? branding?.schoolName ?? "Customer support"}
              </h2>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Customer support
              </p>
              {support?.email ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">{support.email}</p>
                  <div className="mt-6 flex items-center gap-8">
                    <ActionCircle
                      href={`mailto:${support.email}`}
                      label="Email"
                      icon={Mail}
                      tone="brand"
                    />
                  </div>
                </>
              ) : (
                <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                  Reach out to your school&apos;s front desk for any help with classes, fees, or
                  scheduling.
                </p>
              )}
            </SpotlightCard>
          </BlurFade>
        </div>
      )}
    </div>
  );
}
