import {
  CalendarDays,
  CreditCard,
  Guitar,
  LayoutDashboard,
  LifeBuoy,
  Music,
  Timer,
  UserRound,
} from "lucide-react";
import type { SidebarSection } from "@maxmusic/ui";

/** Shared nav config — used by the desktop Sidebar and the mobile drawer. */
export const NAV_SECTIONS: SidebarSection[] = [
  {
    label: "My School",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Classes", href: "/classes", icon: Music },
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
      { label: "Payments", href: "/payments", icon: CreditCard },
      { label: "Profile", href: "/profile", icon: UserRound },
    ],
  },
  {
    label: "Practice Tools",
    items: [
      { label: "Metronome", href: "/metronome", icon: Timer },
      { label: "Guitar Chords", href: "/chords", icon: Guitar },
    ],
  },
  {
    label: "Support",
    items: [{ label: "Contact Us", href: "/contact", icon: LifeBuoy }],
  },
];
