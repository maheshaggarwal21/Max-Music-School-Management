"use client";
// Teacher login — mobile+password OR mobile OTP (CONTRACTS.md:
// POST /api/inst/:slug/auth/teacher/login · /otp/request · /otp/verify).
// WHITE-LABEL: shows ONLY the institution's BrandingPublic. The operator's
// name/domain never appears here.

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BrandingProvider, Button, Input } from "@maxmusic/ui";
import { isValidPhone } from "@maxmusic/utils";
import { api, getInstSlug, mockable, teacherAuthPath } from "@/lib/api";
import { MOCK_BRANDING, MOCK_LOGIN } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic, TeacherLoginData } from "@/lib/types";

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
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-auth branding from the public GET /api/inst/:slug/branding endpoint
  // (white-label safe; mock mode uses MOCK_BRANDING).
  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<BrandingPublic>>(`/api/inst/${getInstSlug()}/branding`),
      { success: true, message: "OK", data: MOCK_BRANDING }
    )
      .then((res) => {
        if (!cancelled && res.data) setBranding(res.data);
      })
      .catch(() => {
        /* neutral fallback until login returns BrandingPublic */
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

  const finishLogin = (institution: BrandingPublic | undefined) => {
    if (institution) setBranding(institution);
    router.replace(`/${slug}/teacher/dashboard`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidPhone(mobile)) next.mobile = "Enter a valid 10-digit mobile number";
    if (password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<TeacherLoginData>>(teacherAuthPath("/login"), {
            mobile,
            password,
          }),
        MOCK_LOGIN,
        600
      );
      if (res.data) {
        finishLogin(res.data.institution);
      } else {
        toast.error(res.message || "Sign in failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async () => {
    if (!isValidPhone(mobile)) {
      setErrors({ mobile: "Enter a valid 10-digit mobile number" });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await mockable(
        () => api.post<ApiResponse<null>>(teacherAuthPath("/otp/request"), { mobile }),
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
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<TeacherLoginData>>(teacherAuthPath("/otp/verify"), {
            mobile,
            otp: code,
          }),
        MOCK_LOGIN,
        600
      );
      if (res.data) {
        finishLogin(res.data.institution);
      } else {
        toast.error(res.message || "Sign in failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (submitting) return;
    setMode(next);
    setOtpSent(false);
    setCode("");
    setErrors({});
  };

  const schoolName = branding?.schoolName ?? "";

  return (
    <BrandingProvider branding={branding}>
      <main className="relative flex min-h-dvh items-center justify-center p-6">
        {/* Ambient brand glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-brand opacity-[0.05] blur-[100px]" />
        </div>

        <BlurFade delay={0} className="w-full max-w-sm">
          <div className="flex flex-col gap-7">
            {/* Institution identity — the only brand ever shown */}
            <div className="flex flex-col items-center gap-3 text-center">
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={schoolName}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-xl font-bold text-brand">
                  {schoolName ? schoolName.trim().charAt(0).toUpperCase() : "♪"}
                </span>
              )}
              <div>
                <h1 className="text-2xl font-bold">{schoolName || "Teacher Sign In"}</h1>
                {branding?.tagline && (
                  <p className="mt-1 text-sm text-muted-foreground">{branding.tagline}</p>
                )}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Teacher Panel
              </p>
            </div>

            {/* Sign-in mode toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/40 p-1">
              {(["password", "otp"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  disabled={submitting}
                  className={`h-9 rounded-full text-sm font-medium transition-colors ${
                    mode === m
                      ? "bg-brand text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "password" ? "Password" : "OTP"}
                </button>
              ))}
            </div>

            {mode === "password" ? (
              <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  error={errors.mobile}
                  className="h-11"
                  required
                />
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errors.password}
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[34px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  disabled={submitting}
                  className="group mt-2 h-12 rounded-full"
                >
                  {submitting ? "Signing in…" : "Sign in"}
                  <LogIn className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </form>
            ) : (
              <form onSubmit={submitOtp} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  error={errors.mobile}
                  className="h-11"
                  required
                />

                {!otpSent ? (
                  <Button
                    type="button"
                    variant="brand"
                    size="lg"
                    disabled={submitting}
                    onClick={requestOtp}
                    className="mt-2 h-12 rounded-full"
                  >
                    {submitting ? "Sending…" : "Send OTP"}
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
                      className="h-11 text-center tracking-[0.4em]"
                      required
                    />
                    <Button
                      type="submit"
                      variant="brand"
                      size="lg"
                      disabled={submitting || code.length !== 6}
                      className="mt-1 h-12 rounded-full"
                    >
                      {submitting ? "Verifying…" : "Verify & sign in"}
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

            <p className="text-center text-xs text-muted-foreground">
              Trouble signing in? Contact your school administrator.
            </p>
          </div>
        </BlurFade>
      </main>
    </BrandingProvider>
  );
}
