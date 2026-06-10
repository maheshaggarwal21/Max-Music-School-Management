"use client";
import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck, CalendarDays, Clock, Inbox, Layers, LayoutDashboard, Loader2,
  Settings, Users, Wallet, GraduationCap,
} from "lucide-react";
import {
  Avatar, BrandingProvider, Sidebar, type SidebarSection,
} from "@maxmusic/ui";
import { api, authPath, mockable } from "@/lib/api";
import { MOCK_SESSION, ok } from "@/lib/mocks";
import type { AdminSession, ApiResponse } from "@/lib/types";
import { OperatorBanner } from "@/components/operator-banner";
import { TopNav } from "@/components/top-nav";

// WHITE-LABEL: every brand surface in this shell (sidebar name, logo, accent
// color, document.title via BrandingProvider) comes ONLY from the session's
// BrandingPublic. No operator identity exists anywhere in this app.

const NAV_SECTIONS: SidebarSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Manage",
    items: [
      { label: "New Requests", href: "/requests", icon: Inbox },
      { label: "Students", href: "/students", icon: Users },
      { label: "Teachers", href: "/teachers", icon: GraduationCap },
      { label: "Batches", href: "/batches", icon: Layers },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Payments", href: "/payments", icon: Wallet },
    ],
  },
  {
    label: "Configure",
    items: [
      { label: "Suitable Days", href: "/suitable-days", icon: CalendarDays },
      { label: "Suitable Times", href: "/suitable-times", icon: Clock },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/admin`;
  const navSections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, href: `${base}${i.href}` })),
  }));
  const [session, setSession] = useState<AdminSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<AdminSession>>(authPath("/me")),
      ok(MOCK_SESSION),
      300
    )
      .then((r) => {
        if (cancelled) return;
        if (r.data) setSession(r.data);
        else router.replace(`${base}/login`);
      })
      .catch(() => !cancelled && router.replace(`${base}/login`));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      await mockable(() => api.post<ApiResponse>(authPath("/logout"), {}), ok(null), 200);
    } finally {
      router.replace(`${base}/login`);
    }
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <BrandingProvider branding={session.institution}>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        {/* Operator-view banner — renders ONLY when the mm_impersonate cookie
            is present (superadmin impersonation, P2-07). Nothing for admins. */}
        <OperatorBanner />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar
            brandName={session.institution.schoolName}
            logoUrl={session.institution.logoUrl}
            sections={navSections}
            activeHref={pathname ?? undefined}
            onSignOut={handleSignOut}
            footer={
              <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
                <Avatar name={session.user.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{session.user.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50">
                    Administrator
                  </p>
                </div>
              </div>
            }
          />
          {/* Top nav lives in the content column — it never overlaps the sidebar */}
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav
              adminName={session.user.name}
              schoolName={session.institution.schoolName}
              logoUrl={session.institution.logoUrl}
            />
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </div>
    </BrandingProvider>
  );
}
