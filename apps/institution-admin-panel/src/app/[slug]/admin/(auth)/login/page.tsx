"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, BrandingProvider, Button, Input,
} from "@maxmusic/ui";
import { isValidEmail, isValidPhone } from "@maxmusic/utils";
import { api, authPath, getInstSlug, mockable } from "@/lib/api";
import { MOCK_BRANDING, MOCK_SESSION, ok } from "@/lib/mocks";
import type { AdminSession, ApiResponse, BrandingPublic } from "@/lib/types";

// WHITE-LABEL: this page renders ONLY the institution's BrandingPublic —
// fetched before auth so the school name/logo/color greet the admin.
// Two sign-in alternatives: email+password OR mobile OTP (verified numbers only).
type Mode = "password" | "otp";
const RESEND_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [branding, setBranding] = useState<BrandingPublic | null>(null);
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Public branding endpoint (pre-auth) — see frontend-agent.md branding note.
    mockable(
      () => api.get<ApiResponse<BrandingPublic>>(`/api/inst/${getInstSlug()}/branding`),
      ok(MOCK_BRANDING),
      250
    )
      .then((r) => !cancelled && setBranding(r.data))
      .catch(() => !cancelled && setBranding(null));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }
    setSubmitting(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<AdminSession>>(authPath("/login"), { email, password }),
        ok(MOCK_SESSION),
        600
      );
      router.push(`/${slug}/admin/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign in");
      setSubmitting(false);
    }
  };

  const requestOtp = async () => {
    if (!isValidPhone(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSubmitting(true);
    try {
      const res = await mockable(
        () => api.post<ApiResponse<null>>(authPath("/otp/request"), { mobile }),
        ok(null, "If this number is registered and verified, an OTP has been sent"),
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
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<AdminSession>>(authPath("/otp/verify"), { mobile, otp: code }),
        ok(MOCK_SESSION),
        600
      );
      router.push(`/${slug}/admin/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setCode("");
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (submitting) return;
    setMode(next);
    setOtpSent(false);
    setCode("");
  };

  return (
    <BrandingProvider branding={branding}>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
        {/* Ambient brand glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute left-1/2 top-1/4 h-[360px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.06] blur-[120px]"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        <BlurFade delay={0} className="w-full max-w-sm">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-xl">
            <BorderBeam size={70} duration={8} />

            {/* School identity — from BrandingPublic ONLY */}
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={branding.schoolName}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {(branding?.schoolName ?? "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w: string) => w.charAt(0).toUpperCase())
                    .join("") || "·"}
                </span>
              )}
              <div>
                <h1 className="text-xl font-semibold">
                  {branding?.schoolName ?? " "}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {branding?.tagline ?? "Admin sign in"}
                </p>
              </div>
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
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  disabled={submitting}
                  className="group mt-2 h-11 rounded-full transition-all duration-300"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Sign in to Admin
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="flex flex-col gap-4">
                <Input
                  label="Mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
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
                    className="mt-2 h-11 rounded-full transition-all duration-300"
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
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center tracking-[0.4em]"
                      required
                    />
                    <Button
                      type="submit"
                      variant="brand"
                      size="lg"
                      disabled={submitting || code.length !== 6}
                      className="mt-1 h-11 rounded-full transition-all duration-300"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
                    </Button>
                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={submitting || resendIn > 0}
                      className="mx-auto text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                    >
                      {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </>
                )}
              </form>
            )}

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              Administrator access only · contact your school owner for credentials
            </p>
          </div>
        </BlurFade>
      </main>
    </BrandingProvider>
  );
}
