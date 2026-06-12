"use client";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  BorderBeam,
  BrandingProvider,
  Button,
  GradientText,
  Input,
  ShinyText,
  SpotlightCard,
} from "@maxmusic/ui";

import { api, getInstSlug, mockable, studentAuthPath } from "@/lib/api";
import { MOCK_BRANDING, MOCK_LOGIN_RESPONSE, type StudentLoginResponse } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic } from "@/lib/types";

// WHITE-LABEL: this page is branding-led — the institution's school name,
// logo and color are the ONLY identity ever shown. No operator branding, ever.
//
// BLOCKED (Dev A): there is no public pre-login branding endpoint in
// CONTRACTS.md yet (branding currently arrives in the login response). Until
// `GET /api/inst/:slug/branding` exists, real mode renders a neutral hero
// before sign-in; mock mode uses MOCK_BRANDING.

type Mode = "password" | "otp";
const RESEND_SECONDS = 30;

const OTP_REQUESTED: ApiResponse<null> = {
  success: true,
  message: "If this number is registered and verified, an OTP has been sent",
  data: null,
};

export default function LoginPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [branding, setBranding] = useState<BrandingPublic | null>(null);
  const [mode, setMode] = useState<Mode>("password");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockable<BrandingPublic | null>(
      () =>
        api
          .get<ApiResponse<BrandingPublic>>(`/api/inst/${getInstSlug()}/branding`)
          .then((r) => r.data),
      MOCK_BRANDING
    ).then((b) => {
      if (cancelled) return;
      setBranding(b);
      if (b?.schoolName) document.title = b.schoolName;
    });
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendIn(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1 && timerRef.current) clearInterval(timerRef.current);
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  async function requestOtp() {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSubmitting(true);
    try {
      const res = await mockable(
        () => api.post<ApiResponse<null>>(studentAuthPath("/otp/request"), { mobile }),
        OTP_REQUESTED,
        400
      );
      setOtpSent(true);
      setCode("");
      startResendTimer();
      toast.info(res.message || "OTP sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      toast.error("Enter the code you received");
      return;
    }
    setSubmitting(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<StudentLoginResponse>>(studentAuthPath("/otp/verify"), {
            mobile,
            otp: code,
          }),
        {
          success: true,
          message: "Welcome back!",
          data: MOCK_LOGIN_RESPONSE,
        } as ApiResponse<StudentLoginResponse>,
        600
      );
      toast.success(`Welcome back! Loading your classes…`);
      router.push(`/${slug}/student/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setCode("");
      setSubmitting(false);
    }
  }

  const switchMode = (next: Mode) => {
    if (submitting) return;
    setMode(next);
    setOtpSent(false);
    setCode("");
  };

  const schoolName = branding?.schoolName ?? "Your Music School";
  const initial = schoolName.trim().charAt(0).toUpperCase() || "♪";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile || !password) {
      toast.error("Please enter your mobile number and password");
      return;
    }
    setSubmitting(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<StudentLoginResponse>>(studentAuthPath("/login"), {
            mobile,
            password,
          }),
        {
          success: true,
          message: "Welcome back!",
          data: MOCK_LOGIN_RESPONSE,
        } as ApiResponse<StudentLoginResponse>,
        600
      );
      toast.success(`Welcome back! Loading your classes…`);
      router.push(`/${slug}/student/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  }

  return (
    <BrandingProvider branding={branding}>
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-6">
        {/* Ambient brand glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-[-80px] h-[340px] w-[560px] -translate-x-1/2 rounded-full opacity-[0.07] blur-[110px]"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        <div className="w-full max-w-sm">
          {/* School hero — institution identity only */}
          <BlurFade delay={0}>
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={schoolName}
                  className="h-16 w-16 rounded-2xl object-cover shadow-lg"
                />
              ) : (
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-2xl font-bold text-brand"
                  style={{ boxShadow: "var(--glow-primary-sm)" }}
                >
                  {initial}
                </span>
              )}
              <GradientText className="text-2xl font-bold">{schoolName}</GradientText>
              {branding?.tagline && (
                <ShinyText text={branding.tagline} speed={5} className="text-sm" />
              )}
            </div>
          </BlurFade>

          <BlurFade delay={0.1}>
            <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
              <BorderBeam size={60} duration={8} />
              <div className="mb-5 space-y-1">
                <h1 className="text-lg font-semibold">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to see your classes, schedule and payments.
                </p>
              </div>

              {/* Sign-in mode toggle */}
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/40 p-1">
                {(["password", "otp"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    disabled={submitting}
                    className={`h-9 rounded-full text-sm font-medium transition-colors ${
                      mode === m
                        ? "text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={mode === m ? { backgroundColor: "var(--brand-primary)" } : undefined}
                  >
                    {m === "password" ? "Password" : "OTP"}
                  </button>
                ))}
              </div>

              {mode === "password" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    variant="brand"
                    size="lg"
                    type="submit"
                    disabled={submitting}
                    className="group h-12 w-full rounded-full transition-all duration-300"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={submitOtp} className="space-y-4">
                  <Input
                    label="Mobile number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required
                  />

                  {!otpSent ? (
                    <Button
                      type="button"
                      variant="brand"
                      size="lg"
                      disabled={submitting}
                      onClick={requestOtp}
                      className="h-12 w-full rounded-full transition-all duration-300"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                    </Button>
                  ) : (
                    <>
                      <Input
                        label="One-time code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
                        className="text-center tracking-[0.4em]"
                        required
                      />
                      <Button
                        type="submit"
                        variant="brand"
                        size="lg"
                        disabled={submitting || code.length < 6}
                        className="h-12 w-full rounded-full transition-all duration-300"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
                      </Button>
                      <button
                        type="button"
                        onClick={requestOtp}
                        disabled={submitting || resendIn > 0}
                        className="mx-auto block text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                      >
                        {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                      </button>
                    </>
                  )}
                </form>
              )}
            </SpotlightCard>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Forgot your password? Ask your school to reset it for you.
            </p>
          </BlurFade>
        </div>
      </main>
    </BrandingProvider>
  );
}
