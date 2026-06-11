"use client";
// P5-09 — Settings: profile card, 2FA enable flow (mock QR + verify code),
// default rent, instruments chip manager. All via mockable().

import { useEffect, useState } from "react";
import {
  IndianRupee,
  Loader2,
  Music2,
  Plus,
  QrCode,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade,
  BorderBeam,
  Button,
  cn,
  Input,
  Select,
} from "@maxmusic/ui";
import { formatCurrency } from "@maxmusic/utils";
import { OtpInput } from "@/components/otp-input";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/skeleton";
import { Tag } from "@/components/tag";
import { api, mockable } from "@/lib/api";
import {
  mock2faEnableStart,
  mock2faVerified,
  mockSettings,
  mockSettingsSaved,
} from "@/lib/mocks";
import type { ApiResponse, OperatorSettingsData } from "@/lib/types";

/** Deterministic mock QR placeholder — a pseudo-random 21×21 module grid. */
function MockQr({ seed }: { seed: string }) {
  const cells: boolean[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < 21 * 21; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    cells.push((h & 4) === 0);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
  return (
    <div
      className="grid aspect-square w-40 gap-px rounded-lg border border-border bg-background p-2"
      style={{ gridTemplateColumns: "repeat(21, 1fr)" }}
      aria-label="Mock QR code"
    >
      {cells.map((on, i) => {
        const r = Math.floor(i / 21);
        const c = i % 21;
        const finderRing =
          isFinder(r, c) &&
          (r === 0 || r === 6 || c === 0 || c === 6 || r === 14 || r === 20 || c === 14 || c === 20 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
            (r >= 2 && r <= 4 && c >= 16 && c <= 18) ||
            (r >= 16 && r <= 18 && c >= 2 && c <= 4));
        const filled = isFinder(r, c) ? finderRing : on;
        return <span key={i} className={cn("aspect-square", filled ? "bg-foreground" : "bg-transparent")} />;
      })}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OperatorSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // 2fa
  const [enrolling, setEnrolling] = useState(false);
  const [qrSecret, setQrSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // defaults
  const [rentRupees, setRentRupees] = useState("");
  const [billingCycle, setBillingCycle] = useState<string | null>("monthly");
  const [savingDefaults, setSavingDefaults] = useState(false);

  // instruments
  const [newInstrument, setNewInstrument] = useState("");

  useEffect(() => {
    let alive = true;
    mockable(
      () => api.get<ApiResponse<OperatorSettingsData>>("/api/operator/settings"),
      mockSettings()
    )
      .then((res) => {
        if (!alive || !res.data) return;
        setSettings(res.data);
        setName(res.data.profile.name);
        setEmail(res.data.profile.email);
        setRentRupees(String(Math.round(res.data.defaultRent.amount / 100)));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const patchSettings = async (next: OperatorSettingsData, message: string) => {
    await mockable(
      () => api.patch<ApiResponse<OperatorSettingsData>>("/api/operator/settings", next),
      mockSettingsSaved(next)
    );
    setSettings(next);
    toast.success(message);
  };

  const saveProfile = async () => {
    if (!settings) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSavingProfile(true);
    try {
      await patchSettings(
        { ...settings, profile: { name: name.trim(), email: email.trim() } },
        "Profile saved"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ otpauthUrl: string; secret: string }>>(
            "/api/operator/settings/2fa/enable",
            {}
          ),
        mock2faEnableStart()
      );
      if (res.data) setQrSecret(res.data.secret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start 2FA setup");
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnroll = async (code: string) => {
    if (!settings || verifying) return;
    setVerifying(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ twoFactorEnabled: boolean }>>(
            "/api/operator/settings/2fa/verify",
            { code }
          ),
        mock2faVerified()
      );
      setSettings({ ...settings, twoFactorEnabled: true });
      setQrSecret(null);
      setVerifyCode("");
      toast.success("Two-factor authentication enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
      setVerifyCode("");
    } finally {
      setVerifying(false);
    }
  };

  const saveDefaults = async () => {
    if (!settings) return;
    const rupees = Number(rentRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toast.error("Enter a valid default rent");
      return;
    }
    setSavingDefaults(true);
    try {
      await patchSettings(
        {
          ...settings,
          defaultRent: { amount: Math.round(rupees * 100), billingCycle: "monthly" },
        },
        "Default rent saved"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save defaults");
    } finally {
      setSavingDefaults(false);
    }
  };

  const addInstrument = async () => {
    if (!settings) return;
    const label = newInstrument.trim();
    if (!label) return;
    if (settings.instruments.some((i) => i.name.toLowerCase() === label.toLowerCase())) {
      toast.error(`"${label}" is already in the list`);
      return;
    }
    const next: OperatorSettingsData = {
      ...settings,
      instruments: [
        ...settings.instruments,
        { _id: `ins_new_${Date.now()}`, name: label, isActive: true },
      ],
    };
    setNewInstrument("");
    try {
      await patchSettings(next, `"${label}" added to instruments`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add instrument");
    }
  };

  const removeInstrument = async (id: string) => {
    if (!settings) return;
    const target = settings.instruments.find((i) => i._id === id);
    const next: OperatorSettingsData = {
      ...settings,
      instruments: settings.instruments.filter((i) => i._id !== id),
    };
    try {
      await patchSettings(next, `"${target?.name}" removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove instrument");
    }
  };

  if (loading || !settings) {
    return (
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        subtitle="Operator profile · security · platform defaults"
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Profile */}
        <BlurFade delay={0.1}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} />
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-brand" /> Profile
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The superadmin identity shown on audit entries.
            </p>
            <div className="mt-5 space-y-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div className="flex justify-end">
                <Button variant="brand" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save profile
                </Button>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* 2FA */}
        <BlurFade delay={0.15}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={2} />
            <div className="flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-brand" /> Two-factor authentication
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  TOTP is mandatory for operator logins.
                </p>
              </div>
              {settings.twoFactorEnabled ? <Tag>enabled</Tag> : <Tag tone="amber">disabled</Tag>}
            </div>

            <div className="mt-5">
              {settings.twoFactorEnabled && !qrSecret ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Your authenticator is configured. 2FA is mandatory for operators and
                    cannot be turned off — you can re-enroll a new device below.
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={startEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Re-configure device
                  </Button>
                </div>
              ) : qrSecret ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-5">
                    <MockQr seed={qrSecret} />
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        <QrCode className="h-3.5 w-3.5 text-brand" /> Scan with your authenticator
                      </p>
                      <p>Or enter the secret manually:</p>
                      <p className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-foreground">
                        {qrSecret}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium">Enter the 6-digit code to confirm</p>
                    <OtpInput
                      value={verifyCode}
                      onChange={setVerifyCode}
                      onComplete={verifyEnroll}
                      disabled={verifying}
                      className="justify-start"
                    />
                  </div>
                </div>
              ) : (
                <Button variant="brand" className="rounded-full" onClick={startEnroll} disabled={enrolling}>
                  {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>
        </BlurFade>

        {/* Default rent */}
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={4} />
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <IndianRupee className="h-4 w-4 text-brand" /> Default rent
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-filled when creating an autonomous institution. Currently{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(settings.defaultRent.amount)}
              </span>{" "}
              / {settings.defaultRent.billingCycle}.
            </p>
            <div className="mt-5 flex items-end gap-3">
              <Input
                label="Amount (₹ / month)"
                type="number"
                min={0}
                value={rentRupees}
                onChange={(e) => setRentRupees(e.target.value)}
                className="max-w-[180px]"
              />
              <Select
                label="Billing cycle"
                options={[{ value: "monthly", label: "Monthly" }]}
                value={billingCycle}
                onChange={setBillingCycle}
                className="max-w-[160px]"
              />
              <Button variant="brand" onClick={saveDefaults} disabled={savingDefaults}>
                {savingDefaults && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </BlurFade>

        {/* Instruments */}
        <BlurFade delay={0.25}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={6} />
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Music2 className="h-4 w-4 text-brand" /> Instruments master list
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Available to every institution when creating batches and enrolling students.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {settings.instruments.map((ins) => (
                <span
                  key={ins._id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    ins.isActive
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {ins.name}
                  <button
                    type="button"
                    aria-label={`Remove ${ins.name}`}
                    onClick={() => removeInstrument(ins._id)}
                    className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-end gap-2">
              <Input
                label="Add instrument"
                placeholder="e.g. Mridangam"
                value={newInstrument}
                onChange={(e) => setNewInstrument(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInstrument();
                  }
                }}
                className="max-w-[220px]"
              />
              <Button variant="outline" className="group rounded-full" onClick={addInstrument}>
                Add
                <Plus className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
