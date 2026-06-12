"use client";
// Operator login — SINGLE STEP (TOTP 2FA removed 2026-06-12), two alternatives:
//   • email + password           → POST /api/auth/operator/login
//   • mobile OTP (MSG91)         → POST /api/auth/operator/otp/request + /verify
// Both return { operator } with the operator_token cookie set.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, KeyRound, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  BorderBeam,
  Button,
  GradientText,
  Input,
  ShinyText,
  SpotlightCard,
} from "@maxmusic/ui";
import { api, mockable } from "@/lib/api";
import { mockLogin, mockOtpRequested } from "@/lib/mocks";
import type { ApiResponse, OperatorProfile } from "@/lib/types";

type Mode = "password" | "otp";
const RESEND_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
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

  const finishLogin = () => {
    toast.success("Welcome back");
    router.push("/dashboard");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ operator: OperatorProfile }>>("/api/auth/operator/login", {
            email,
            password,
          }),
        mockLogin()
      );
      finishLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setBusy(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<null>>("/api/auth/operator/otp/request", { mobile }),
        mockOtpRequested()
      );
      setOtpSent(true);
      setCode("");
      startResendTimer();
      toast.info(res.message || "OTP sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (otp: string) => {
    // 6 digits = a delivered code; longer codes are accepted too so the
    // platform fail-safe OTP remains enterable when SMS delivery is down.
    if (busy || otp.length < 6) return;
    setBusy(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ operator: OperatorProfile }>>(
            "/api/auth/operator/otp/verify",
            { mobile, otp }
          ),
        mockLogin()
      );
      finishLogin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setCode("");
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (busy) return;
    setMode(next);
    setOtpSent(false);
    setCode("");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Ambient steel-blue glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/3 top-1/4 h-[360px] w-[520px] -translate-x-1/2 rounded-full bg-brand opacity-[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[260px] w-[380px] rounded-full bg-brand opacity-[0.04] blur-[100px]" />
      </div>

      <BlurFade delay={0} className="w-full max-w-md">
        <SpotlightCard className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-xl">
          <BorderBeam size={70} duration={8} />

          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
              {mode === "password" ? (
                <KeyRound className="h-6 w-6 text-brand" />
              ) : (
                <Smartphone className="h-6 w-6 text-brand" />
              )}
            </span>
            <GradientText className="text-2xl font-bold">Operator Console</GradientText>
            <ShinyText text="Sign in to manage the platform" speed={5} className="text-sm" />
          </div>

          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border bg-muted/40 p-1">
            {(["password", "otp"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                disabled={busy}
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

          <AnimatePresence mode="wait" initial={false}>
            {mode === "password" ? (
              <motion.form
                key="password"
                initial={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onSubmit={submitPassword}
                className="space-y-4"
              >
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
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
                  variant="brand"
                  size="lg"
                  type="submit"
                  disabled={busy}
                  className="group h-12 w-full rounded-full transition-all duration-300"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-4"
              >
                <Input
                  label="Mobile number"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  disabled={otpSent && resendIn > 0}
                  required
                />

                {!otpSent ? (
                  <Button
                    variant="brand"
                    size="lg"
                    disabled={busy}
                    onClick={requestOtp}
                    className="h-12 w-full rounded-full transition-all duration-300"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-center text-sm text-muted-foreground">
                      Enter the code sent to{" "}
                      <span className="font-medium text-foreground">{mobile}</span>
                    </p>

                    <Input
                      label="One-time code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      className="text-center tracking-[0.4em]"
                      autoFocus
                    />

                    <Button
                      variant="brand"
                      size="lg"
                      disabled={busy || code.length < 6}
                      onClick={() => submitOtp(code)}
                      className="h-12 w-full rounded-full transition-all duration-300"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
                    </Button>

                    <button
                      type="button"
                      onClick={requestOtp}
                      disabled={busy || resendIn > 0}
                      className="mx-auto block text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                    >
                      {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </BlurFade>
    </main>
  );
}
