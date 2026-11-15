import {
  BarChart3,
  Building2,
  Inbox,
  KanbanSquare,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "inbox";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar. Settings lives in the account menu there. */
  inTabBar: boolean;
  badge?: NavBadgeKey;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, inTabBar: true },
  { href: "/targets", label: "Targets", icon: Building2, inTabBar: true },
  {
    href: "/inbox",
    label: "Inbox",
    icon: Inbox,
    inTabBar: true,
    badge: "inbox",
  },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, inTabBar: true },
  { href: "/insights", label: "Insights", icon: BarChart3, inTabBar: true },
  { href: "/settings", label: "Settings", icon: Settings, inTabBar: false },
];

export type NavCounts = Partial<Record<NavBadgeKey, number>>;

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
