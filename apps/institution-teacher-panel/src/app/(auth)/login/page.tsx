"use client";
// Teacher login — mobile + password (CONTRACTS.md: POST /api/inst/:slug/auth/teacher/login).
// WHITE-LABEL: shows ONLY the institution's BrandingPublic. The operator's
// name/domain never appears here.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";
import { BlurFade, BrandingProvider, Button, Input } from "@maxmusic/ui";
import { isValidPhone } from "@maxmusic/utils";
import { api, mockable, teacherAuthPath } from "@/lib/api";
import { MOCK_BRANDING, MOCK_LOGIN } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic, TeacherLoginData } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<BrandingPublic | null>(null);
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ mobile?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Pre-auth branding. TODO(H5): a public GET branding endpoint is not yet in
  // CONTRACTS.md (frontend-agent.md anticipates one) — flagged to Dev A. Until
  // then the login POST response is the canonical branding source.
  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<BrandingPublic>>(teacherAuthPath("/branding")),
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
    };
  }, []);

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
        setBranding(res.data.institution);
        router.replace("/dashboard");
      } else {
        toast.error(res.message || "Sign in failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
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
          <div className="flex flex-col gap-8">
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

            <p className="text-center text-xs text-muted-foreground">
              Trouble signing in? Contact your school administrator.
            </p>
          </div>
        </BlurFade>
      </main>
    </BrandingProvider>
  );
}
