"use client";
// Authenticated shell: shared Sidebar (brandName "Operator Console") + Topbar.
// Auth is cookie-based; the api client redirects to /login on any 401.

import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Building2,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar, type SidebarSection } from "@maxmusic/ui";
import { Topbar } from "@/components/topbar";
import { api, mockable } from "@/lib/api";
import { mockLogout } from "@/lib/mocks";
import type { ApiResponse } from "@/lib/types";

const SECTIONS: SidebarSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Platform",
    items: [
      { label: "Institutions", href: "/institutions", icon: Building2 },
      { label: "Slug Requests", href: "/slug-requests", icon: ArrowLeftRight },
      { label: "Students", href: "/students", icon: GraduationCap },
      { label: "Teachers", href: "/teachers", icon: Users },
      { label: "Credentials", href: "/credentials", icon: KeyRound },
    ],
  },
  {
    label: "Finance",
    items: [{ label: "Payments", href: "/payments", icon: Wallet }],
  },
  {
    label: "System",
    items: [
      { label: "Changes History", href: "/changes", icon: History },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // longest-prefix match so /institutions/[id] highlights "Institutions"
  const activeHref = SECTIONS.flatMap((s) => s.items)
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const signOut = async () => {
    try {
      await mockable(
        () => api.post<ApiResponse<null>>("/api/auth/operator/logout", {}),
        mockLogout()
      );
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        brandName="Operator Console"
        sections={SECTIONS}
        activeHref={activeHref}
        onSignOut={signOut}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="relative flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
