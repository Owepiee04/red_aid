import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Settings,
  UserCheck,
  FilePlus2,
  Home,
  type LucideIcon,
} from "lucide-react";
import type { AppUser } from "@/types/auth";

export const ROLE = {
  admin: "admin",
  teamLeader: "team_leader",
  charter: "charter",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  team_leader: "Team Leader",
  charter: "Charter",
};

export function roleOf(user: AppUser | null | undefined): Role | null {
  if (!user) return null;
  if (user.role === "admin") return ROLE.admin;
  if (user.duty_role === ROLE.teamLeader) return ROLE.teamLeader;
  if (user.duty_role === ROLE.charter) return ROLE.charter;
  return null;
}

export function homePathFor(user: AppUser | null | undefined): string | null {
  const role = roleOf(user);
  if (role === ROLE.admin) return "/admin";
  if (role === ROLE.teamLeader) return "/team-leader";
  if (role === ROLE.charter) return "/charter";
  return null;
}

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  admin: [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
    { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
    { label: "Reports", to: "/admin/reports", icon: ClipboardList },
    { label: "Accounts", to: "/admin/accounts", icon: Users },
    { label: "Settings", to: "/admin/settings", icon: Settings },
  ],
  team_leader: [
    { label: "Dashboard", to: "/team-leader", icon: LayoutDashboard },
    { label: "Verify", to: "/team-leader/verify", icon: UserCheck },
    { label: "Calendar", to: "/team-leader/calendar", icon: CalendarDays },
    { label: "Reports", to: "/team-leader/reports", icon: ClipboardList },
    { label: "Settings", to: "/team-leader/settings", icon: Settings },
  ],
  charter: [
    { label: "Home", to: "/charter", icon: Home },
    { label: "New Report", to: "/charter/report/new", icon: FilePlus2 },
    { label: "My Reports", to: "/charter/reports", icon: ClipboardList },
    { label: "Calendar", to: "/charter/calendar", icon: CalendarDays },
    { label: "Settings", to: "/charter/settings", icon: Settings },
  ],
};

export function navFor(role: Role | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS[role] ?? [];
}
