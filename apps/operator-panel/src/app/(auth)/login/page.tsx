"use client";
// P5-02 — Operator login: email+password → TOTP 2FA (6-digit, paste support).
// Mirrors CONTRACTS.md: POST /api/auth/operator/login → { twoFactorRequired,
// challengeToken }; POST /api/auth/operator/verify-2fa → cookie + operator.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
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
import { OtpInput } from "@/components/otp-input";
import { api, mockable } from "@/lib/api";
import { mockLoginChallenge, mockVerify2fa } from "@/lib/mocks";
import type { ApiResponse, OperatorLoginChallenge, OperatorProfile } from "@/lib/types";

type Step = "credentials" | "totp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<OperatorLoginChallenge>>("/api/auth/operator/login", {
            email,
            password,
          }),
        mockLoginChallenge()
      );
      if (res.data?.twoFactorRequired) {
        setChallengeToken(res.data.challengeToken);
        setStep("totp");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (totp: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ operator: OperatorProfile }>>(
            "/api/auth/operator/verify-2fa",
            { challengeToken, code: totp }
          ),
        mockVerify2fa()
      );
      toast.success("Welcome back");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
      setCode("");
      setBusy(false);
    }
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

          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
              {step === "credentials" ? (
                <KeyRound className="h-6 w-6 text-brand" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-brand" />
              )}
            </span>
            <GradientText className="text-2xl font-bold">Operator Console</GradientText>
            <ShinyText
              text={
                step === "credentials"
                  ? "Sign in to manage the platform"
                  : "Two-factor verification"
              }
              speed={5}
              className="text-sm"
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === "credentials" ? (
              <motion.form
                key="credentials"
                initial={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onSubmit={submitCredentials}
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
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="totp"
                initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 24, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="space-y-6"
              >
                <p className="text-center text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app for{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>

                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={submitCode}
                  disabled={busy}
                  autoFocus
                />

                <Button
                  variant="brand"
                  size="lg"
                  disabled={busy || code.length !== 6}
                  onClick={() => submitCode(code)}
                  className="h-12 w-full rounded-full transition-all duration-300"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setCode("");
                  }}
                  disabled={busy}
                  className="mx-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to credentials
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </BlurFade>
    </main>
  );
}
