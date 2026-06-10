// Operator → institution admin panel "open panel" (eye) handshake.
//
// PRODUCTION: this becomes the god-token impersonation flow — Dev A's P3-05
// endpoint POST /api/operator/institutions/:id/impersonate returns
// { url: "https://<PLATFORM_DOMAIN>/<slug>/admin?imp=1" } with a short-lived
// god-token cookie, and THAT url is opened instead of the dev-port URL built
// here. The mm_impersonate cookie disappears entirely in that flow.
//
// MOCK MODE: mm_impersonate is NOT a token or credential — it is a mock-mode
// DISPLAY HINT ("slug|name") that the institution admin panel app, running on
// the same localhost host, reads to show which institution the operator is
// viewing. Cookie only (host-scoped, path=/) — never browser storage.

import { toast } from "sonner";

export function openInstitutionAdminPanel(inst: { slug: string; name: string }): void {
  if (typeof window === "undefined") return;

  // Mock-mode display hint readable by the admin panel app on the same host.
  document.cookie =
    "mm_impersonate=" + encodeURIComponent(inst.slug + "|" + inst.name) + "; path=/";

  const base =
    process.env.NEXT_PUBLIC_ADMIN_PANEL_URL ||
    `${window.location.protocol}//${window.location.hostname}:3001`;

  toast.success(`Opening ${inst.name} admin panel — operator access`);
  // Same-tab navigation to the REAL slug-aware admin route. The god cookie set by
  // the impersonate POST (inst_admin_token, path /api/inst/<slug>) authenticates
  // the panel's /me call, so it lands on the dashboard, not the login page.
  // The operator returns via the browser back button.
  window.location.assign(`${base}/${inst.slug}/admin/dashboard?imp=1`);
}
