"use client";
// Settings: profile card, mobile-for-OTP-login card, fail-safe master OTP card,
// default rent, instruments chip manager. TOTP 2FA was removed (2026-06-12) —
// operator login is single-step: email+password OR mobile OTP.

import { useEffect, useState } from "react";
import {
  IndianRupee,
  KeySquare,
  Loader2,
  Music2,
  Plus,
  Smartphone,
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
  mockGodOtpSaved,
  mockMobileSet,
  mockMobileVerified,
  mockSettings,
  mockSettingsSaved,
} from "@/lib/mocks";
import type { ApiResponse, OperatorSettingsData } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<OperatorSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // mobile (for OTP login)
  const [mobileInput, setMobileInput] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileCode, setMobileCode] = useState("");
  const [mobileBusy, setMobileBusy] = useState(false);

  // fail-safe master OTP
  const [godOtp, setGodOtp] = useState("");
  const [godOtpConfirm, setGodOtpConfirm] = useState("");
  const [godPassword, setGodPassword] = useState("");
  const [savingGodOtp, setSavingGodOtp] = useState(false);

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
        setMobileInput(res.data.profile.mobile || "");
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
        { ...settings, profile: { ...settings.profile, name: name.trim(), email: email.trim() } },
        "Profile saved"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Mobile for OTP login: set (sends verification code) → confirm ──────────
  const setMobile = async () => {
    if (!settings) return;
    if (!/^\d{10}$/.test(mobileInput)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setMobileBusy(true);
    try {
      const res = await mockable(
        () =>
          api.post<ApiResponse<{ mobile: string; mobileVerified: boolean }>>(
            "/api/operator/settings/mobile",
            { mobile: mobileInput }
          ),
        mockMobileSet()
      );
      setSettings({
        ...settings,
        profile: { ...settings.profile, mobile: mobileInput, mobileVerified: false },
      });
      setMobileOtpSent(true);
      setMobileCode("");
      toast.info(res.message || "Verification code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send verification code");
    } finally {
      setMobileBusy(false);
    }
  };

  const confirmMobile = async (code: string) => {
    if (!settings || mobileBusy || code.length !== 6) return;
    setMobileBusy(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse<{ mobile: string; mobileVerified: boolean }>>(
            "/api/operator/settings/mobile/verify",
            { otp: code }
          ),
        mockMobileVerified()
      );
      setSettings({
        ...settings,
        profile: { ...settings.profile, mobileVerified: true },
      });
      setMobileOtpSent(false);
      setMobileCode("");
      toast.success("Mobile number verified — OTP login is now enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setMobileCode("");
    } finally {
      setMobileBusy(false);
    }
  };

  // ── Fail-safe master OTP (password-confirmed) ───────────────────────────────
  const saveGodOtp = async () => {
    if (!settings) return;
    if (!/^\d{8,12}$/.test(godOtp)) {
      toast.error("The fail-safe OTP must be 8–12 digits");
      return;
    }
    if (godOtp !== godOtpConfirm) {
      toast.error("The two OTP entries do not match");
      return;
    }
    if (!godPassword) {
      toast.error("Enter your password to confirm");
      return;
    }
    setSavingGodOtp(true);
    try {
      const res = await mockable(
        () =>
          api.patch<ApiResponse<{ godOtp: OperatorSettingsData["godOtp"] }>>(
            "/api/operator/settings/god-otp",
            { newOtp: godOtp, password: godPassword }
          ),
        mockGodOtpSaved()
      );
      if (res.data) setSettings({ ...settings, godOtp: res.data.godOtp });
      setGodOtp("");
      setGodOtpConfirm("");
      setGodPassword("");
      toast.success("Fail-safe OTP updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update fail-safe OTP");
    } finally {
      setSavingGodOtp(false);
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

  const mobileVerified = settings.profile.mobileVerified;

  return (
    <div className="relative flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        subtitle="Operator profile · sign-in options · platform defaults"
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

        {/* Mobile for OTP login */}
        <BlurFade delay={0.15}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={2} />
            <div className="flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="h-4 w-4 text-brand" /> Mobile number
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Used for OTP sign-in. Codes are sent only to a verified number.
                </p>
              </div>
              {mobileVerified ? <Tag>verified</Tag> : <Tag tone="amber">unverified</Tag>}
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-end gap-3">
                <Input
                  label="Mobile (10 digits)"
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="max-w-[220px]"
                />
                <Button
                  variant={mobileVerified ? "outline" : "brand"}
                  className="rounded-full"
                  onClick={setMobile}
                  disabled={mobileBusy}
                >
                  {mobileBusy && !mobileOtpSent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mobileVerified && mobileInput === (settings.profile.mobile || "") ? (
                    "Re-verify"
                  ) : (
                    "Save & send code"
                  )}
                </Button>
              </div>

              {mobileOtpSent && (
                <div>
                  <p className="mb-2 text-xs font-medium">
                    Enter the 6-digit code sent to {settings.profile.mobile}
                  </p>
                  <OtpInput
                    value={mobileCode}
                    onChange={setMobileCode}
                    onComplete={confirmMobile}
                    disabled={mobileBusy}
                    className="justify-start"
                  />
                </div>
              )}
            </div>
          </div>
        </BlurFade>

        {/* Fail-safe master OTP */}
        <BlurFade delay={0.2}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={4} />
            <div className="flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <KeySquare className="h-4 w-4 text-brand" /> Fail-safe master OTP
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  If SMS delivery is down, any user can sign into their own account
                  with their mobile + this code. Stored hashed — it can be replaced
                  but never viewed.
                </p>
              </div>
              {settings.godOtp.isSet ? <Tag>set</Tag> : <Tag tone="amber">not set</Tag>}
            </div>

            {(settings.godOtp.updatedAt || settings.godOtp.lastUsedAt) && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {settings.godOtp.updatedAt &&
                  `Last changed ${new Date(settings.godOtp.updatedAt).toLocaleString()}`}
                {settings.godOtp.lastUsedAt &&
                  ` · Last used ${new Date(settings.godOtp.lastUsedAt).toLocaleString()}`}
              </p>
            )}

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="New OTP (8–12 digits)"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={godOtp}
                  onChange={(e) => setGodOtp(e.target.value.replace(/\D/g, "").slice(0, 12))}
                />
                <Input
                  label="Confirm new OTP"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••••••"
                  value={godOtpConfirm}
                  onChange={(e) => setGodOtpConfirm(e.target.value.replace(/\D/g, "").slice(0, 12))}
                />
              </div>
              <Input
                label="Your password (required to confirm)"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={godPassword}
                onChange={(e) => setGodPassword(e.target.value)}
              />
              <div className="flex justify-end">
                <Button variant="brand" onClick={saveGodOtp} disabled={savingGodOtp}>
                  {savingGodOtp && <Loader2 className="h-4 w-4 animate-spin" />}
                  {settings.godOtp.isSet ? "Replace fail-safe OTP" : "Set fail-safe OTP"}
                </Button>
              </div>
            </div>
          </div>
        </BlurFade>

        {/* Default rent */}
        <BlurFade delay={0.25}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={6} />
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
        <BlurFade delay={0.3}>
          <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
            <BorderBeam size={50} duration={10} delay={8} />
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
