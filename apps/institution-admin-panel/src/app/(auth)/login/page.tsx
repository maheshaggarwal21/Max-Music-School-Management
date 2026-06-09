"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, BrandingProvider, Button, Input,
} from "@maxmusic/ui";
import { isValidEmail } from "@maxmusic/utils";
import { api, authPath, getInstSlug, mockable } from "@/lib/api";
import { MOCK_BRANDING, MOCK_SESSION, ok } from "@/lib/mocks";
import type { AdminSession, ApiResponse, BrandingPublic } from "@/lib/types";

// WHITE-LABEL: this page renders ONLY the institution's BrandingPublic —
// fetched before auth so the school name/logo/color greet the admin.
export default function LoginPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<BrandingPublic | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    };
  }, []);

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
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to sign in");
      setSubmitting(false);
    }
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
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
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
                    .map((w) => w.charAt(0).toUpperCase())
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

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              Administrator access only · contact your school owner for credentials
            </p>
          </div>
        </BlurFade>
      </main>
    </BrandingProvider>
  );
}
