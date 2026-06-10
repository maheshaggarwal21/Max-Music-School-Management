"use client";
import { useEffect, useRef, useState } from "react";
import { Hourglass, ImagePlus, Link2, Loader2, Palette, Save } from "lucide-react";
import { toast } from "sonner";
import {
  BlurFade, BorderBeam, Button, Input, Modal, cn, useBranding,
} from "@maxmusic/ui";
import { api, adminPath, mockable, MOCKS_ENABLED } from "@/lib/api";
import { MOCK_PROFILE, ok } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic, SchoolProfileData } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";

// Settings = School Profile only. Suitable Days / Suitable Times moved to their
// own tabs; holidays live in the Batches area. The admin can edit branding
// (color, logo, name, tagline) directly — every change is audited and visible
// in the operator console. The SLUG can only be changed via a request your
// platform administrator approves.

const COLOR_PRESETS = [
  "#5B8DEF", "#0D9488", "#7C3AED", "#DC2626",
  "#D97706", "#16A34A", "#0EA5E9", "#334155",
];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_INLINE_LOGO_BYTES = 200 * 1024;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export default function SettingsPage() {
  const branding = useBranding();
  const [profile, setProfile] = useState<SchoolProfileData | null>(null);

  // Editable branding fields.
  const [schoolName, setSchoolName] = useState("");
  const [tagline, setTagline] = useState("");
  const [color, setColor] = useState("#5B8DEF");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Slug change request.
  const [slugModal, setSlugModal] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [slugReason, setSlugReason] = useState("");
  const [requestingSlug, setRequestingSlug] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<SchoolProfileData>>(adminPath("/settings/profile")),
      ok(MOCK_PROFILE)
    ).then((r) => {
      if (cancelled || !r.data) return;
      setProfile(r.data);
      setSchoolName(r.data.branding.schoolName);
      setTagline(r.data.branding.tagline ?? "");
      setColor(r.data.branding.primaryColor);
      setLogoUrl(r.data.branding.logoUrl);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickLogo = () => fileRef.current?.click();

  const onLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    setUploading(true);
    try {
      // Preferred: pre-signed S3 upload. Fallback (uploads not configured):
      // inline the image as a data-URL — small files only.
      const presign = await mockable(
        () =>
          api.post<ApiResponse<{ uploadUrl: string; publicUrl: string }>>(
            adminPath("/settings/logo-upload-url"),
            { filename: file.name, contentType: file.type }
          ),
        ok<{ uploadUrl: string; publicUrl: string } | null>(null),
        300
      ).catch(() => null);

      if (presign?.data?.uploadUrl) {
        const put = await fetch(presign.data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) throw new Error("Upload failed");
        setLogoUrl(presign.data.publicUrl);
        toast.success("Logo uploaded — hit Save to apply it");
        return;
      }

      if (file.size > MAX_INLINE_LOGO_BYTES) {
        toast.error("Logo must be under 200KB (uploads are not configured on this server)");
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      setLogoUrl(dataUrl);
      toast.success("Logo ready — hit Save to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the logo");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!schoolName.trim()) return toast.error("School name is required");
    if (!HEX_COLOR.test(color)) return toast.error("Brand color must be a hex value like #5B8DEF");
    setSaving(true);
    try {
      await mockable(
        () =>
          api.patch<ApiResponse<{ branding: BrandingPublic } | null>>(adminPath("/settings/branding"), {
            schoolName: schoolName.trim(),
            tagline: tagline.trim(),
            primaryColor: color,
            logoUrl: logoUrl ?? "",
          }),
        ok(null),
        500
      );
      toast.success("School profile saved — applying your branding everywhere");
      // The session (and BrandingProvider) re-pulls on load → new color/logo
      // applies across the whole panel. The audit log records each change.
      if (!MOCKS_ENABLED) {
        setTimeout(() => window.location.reload(), 600);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the profile");
    } finally {
      setSaving(false);
    }
  };

  const requestSlug = async () => {
    const candidate = newSlug.trim().toLowerCase();
    if (!SLUG_RX.test(candidate) || candidate.length < 3) {
      return toast.error("Use lowercase letters, numbers and hyphens (min 3 chars)");
    }
    if (candidate === profile?.branding.slug) {
      return toast.error("That is already your current address");
    }
    setRequestingSlug(true);
    try {
      await mockable(
        () =>
          api.post<ApiResponse>(adminPath("/settings/slug-request"), {
            requestedSlug: candidate,
            reason: slugReason.trim() || undefined,
          }),
        ok(null),
        500
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              pendingSlugRequest: {
                _id: `slugreq_local_${Date.now()}`,
                requestedSlug: candidate,
                createdAt: new Date().toISOString(),
              },
            }
          : prev
      );
      toast.success("Request sent — your platform administrator will review it");
      setSlugModal(false);
      setNewSlug("");
      setSlugReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request");
    } finally {
      setRequestingSlug(false);
    }
  };

  const slug = profile?.branding.slug ?? branding?.slug ?? "";

  return (
    <PageShell title="Settings" subtitle="Your school profile and public address">
      <BlurFade delay={0.1}>
        <div className="relative max-w-3xl overflow-hidden rounded-xl border border-border bg-card p-5">
          <BorderBeam size={60} duration={12} />
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10">
              <Palette className="h-4 w-4 text-brand" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">School Profile</h2>
              <p className="text-xs text-muted-foreground">
                How your brand appears across the admin, teacher and student panels
              </p>
            </div>
          </div>

          {!profile ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Logo + add button */}
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={schoolName} className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <span
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {initials(schoolName || "S")}
                  </span>
                )}
                <div>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={pickLogo} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {logoUrl ? "Replace logo" : "Add logo"}
                  </Button>
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 rounded-full text-muted-foreground"
                      onClick={() => setLogoUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Square image works best. Shown on every panel and login page.
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onLogoFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Name + tagline */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="School name" required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
                <Input label="Tagline" placeholder="e.g. Where every note finds its home" value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>

              {/* Brand color */}
              <div>
                <p className="mb-2 text-xs font-medium">Brand color</p>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Use ${c}`}
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        color.toLowerCase() === c.toLowerCase() ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom color"
                    value={HEX_COLOR.test(color) ? color : "#5B8DEF"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
                  />
                  <div className="w-28">
                    <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#5B8DEF" />
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: HEX_COLOR.test(color) ? color : "#5B8DEF" }}
                  >
                    Live preview
                  </span>
                </div>
              </div>

              <div className="flex justify-end border-t border-border pt-4">
                <Button variant="brand" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save profile
                </Button>
              </div>

              {/* Public address (slug) — change via operator-approved request */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <Link2 className="h-3.5 w-3.5 text-brand" />
                  Public address
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs">/{slug}</code>
                  {profile.pendingSlugRequest ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-500">
                      <Hourglass className="h-3 w-3" />
                      Pending approval: /{profile.pendingSlugRequest.requestedSlug}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setSlugModal(true)}>
                      Request address change
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Changing the address logs out everyone and breaks previously shared links, so it
                  needs approval from your platform administrator.
                </p>
              </div>
            </div>
          )}
        </div>
      </BlurFade>

      {/* Slug change request modal */}
      <Modal
        open={slugModal}
        onClose={() => setSlugModal(false)}
        title="Request address change"
        subtitle="Reviewed and applied by your platform administrator"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSlugModal(false)} disabled={requestingSlug}>
              Cancel
            </Button>
            <Button variant="brand" onClick={requestSlug} disabled={requestingSlug || !newSlug.trim()}>
              {requestingSlug && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="New address"
            required
            placeholder="e.g. sunrise-music"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
          />
          <p className="rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
            /{newSlug.trim() || "your-new-address"}/admin
          </p>
          <Input
            label="Reason (optional)"
            placeholder="Why do you want this change?"
            value={slugReason}
            onChange={(e) => setSlugReason(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            On approval every signed-in user of your school is logged out and the old address
            stops working immediately.
          </p>
        </div>
      </Modal>
    </PageShell>
  );
}
