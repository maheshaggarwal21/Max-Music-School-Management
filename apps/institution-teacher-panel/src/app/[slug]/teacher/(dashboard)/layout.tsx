"use client";
// Authenticated shell for the teacher panel.
// WHITE-LABEL: every visible identity (sidebar brand, document.title via
// BrandingProvider, mobile header) comes ONLY from BrandingPublic.

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  LayoutDashboard,
  Moon,
  Music2,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import { BrandingProvider, Sidebar, cn, useThemeTransition } from "@maxmusic/ui";
import { api, mockable, teacherAuthPath, teacherPath } from "@/lib/api";
import { MOCK_ME, MOCK_OK } from "@/lib/mocks";
import type { ApiResponse, BrandingPublic, TeacherMeData } from "@/lib/types";
import { MobileNav } from "@/components/mobile-nav";
import { TopNav } from "@/components/top-nav";
import { PageLoading } from "@/components/skeletons";

// Holidays moved INTO the dashboard (no standalone tab). Teachers roster is
// reachable from the sidebar and the top-nav button.
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Batches", href: "/batches", icon: Music2 },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
  { label: "Teachers", href: "/teachers", icon: Users },
  { label: "Profile", href: "/profile", icon: UserRound },
];

function MobileHeader({ branding }: { branding: BrandingPublic }) {
  const { resolvedTheme, toggleTheme } = useThemeTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.schoolName}
            className="h-8 w-8 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
            {branding.schoolName.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate text-sm font-semibold">{branding.schoolName}</span>
      </div>
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={(e) => toggleTheme(e)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {mounted && resolvedTheme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/teacher`;
  const navItems = NAV_ITEMS.map((i) => ({ ...i, href: `${base}${i.href}` }));
  const [me, setMe] = useState<TeacherMeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockable(
      () => api.get<ApiResponse<TeacherMeData>>(teacherPath("/me")),
      MOCK_ME
    ).then((res) => {
      if (!cancelled && res.data) setMe(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeHref =
    navItems.find(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
    )?.href ?? pathname;

  const signOut = async () => {
    await mockable(
      () => api.post<ApiResponse<null>>(teacherAuthPath("/logout"), {}),
      MOCK_OK
    );
    router.replace(`${base}/login`);
  };

  if (!me) {
    return (
      <BrandingProvider branding={null}>
        <PageLoading />
      </BrandingProvider>
    );
  }

  return (
    <BrandingProvider branding={me.institution}>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar
          className="hidden md:flex"
          brandName={me.institution.schoolName}
          logoUrl={me.institution.logoUrl}
          sections={[{ label: "Teach", items: navItems }]}
          activeHref={activeHref}
          onSignOut={signOut}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileHeader branding={me.institution} />
          <TopNav
            teacherName={me.teacher.name}
            schoolName={me.institution.schoolName}
            logoUrl={me.institution.logoUrl}
            base={base}
            onSignOut={signOut}
          />
          <main className={cn("flex-1 overflow-y-auto pb-24 md:pb-0")}>
            {children}
          </main>
        </div>
      </div>
      <MobileNav items={navItems} activeHref={activeHref} />
    </BrandingProvider>
  );
}
