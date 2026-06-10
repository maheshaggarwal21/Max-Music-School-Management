"use client";
import * as React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Loader2, Music } from "lucide-react";
import { Avatar, BrandingProvider, Sidebar } from "@maxmusic/ui";

import { api, mockable, studentAuthPath } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";
import { StudentProvider, useStudent } from "@/components/student-provider";
import { MobileNav } from "@/components/mobile-nav";
import { NAV_SECTIONS } from "@/components/nav-items";

// Authenticated shell. WHITE-LABEL: the ONLY identity rendered anywhere in
// this layout is the institution's BrandingPublic (schoolName / logoUrl /
// primaryColor). BrandingProvider also sets document.title to schoolName.

function Shell({ children }: { children: React.ReactNode }) {
  const { student, branding, loading } = useStudent();
  const pathname = usePathname();
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const base = `/${slug}/student`;
  const navSections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, href: `${base}${i.href}` })),
  }));

  const handleSignOut = React.useCallback(() => {
    mockable(
      () => api.post<ApiResponse>(studentAuthPath("/logout"), {}),
      { success: true, message: "Signed out", data: null } as ApiResponse
    ).finally(() => router.push(`${base}/login`));
  }, [router, base]);

  if (loading || !branding || !student) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="rounded-2xl bg-brand/10 p-4">
          <Music className="h-7 w-7 animate-pulse text-brand" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <BrandingProvider branding={branding}>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <div className="hidden h-full md:flex">
          <Sidebar
            brandName={branding.schoolName}
            logoUrl={branding.logoUrl}
            sections={navSections}
            activeHref={pathname ?? undefined}
            onSignOut={handleSignOut}
            footer={
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <Avatar name={student.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{student.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {student.displayId}
                  </p>
                </div>
              </div>
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile top bar + drawer */}
          <MobileNav branding={branding} onSignOut={handleSignOut} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BrandingProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <Shell>{children}</Shell>
    </StudentProvider>
  );
}
