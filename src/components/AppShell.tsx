"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldOff } from "lucide-react";
import RedAidLogo from "@/components/RedAidLogo";
import UserAvatar from "@/components/UserAvatar";
import NotificationBell from "@/components/NotificationBell";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABEL, homePathFor, navFor, roleOf, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface AppShellProps {
  /** The only role allowed inside this section of the app. */
  role: Role;
  children: ReactNode;
}

/**
 * The frame around every signed-in page: a sidebar on desktop, a top bar plus
 * bottom tab bar on phones, and a logout button. It also guards the section:
 *   - signed out            -> /login
 *   - signed in, wrong role -> that person's own home (or "/" if they have no role yet)
 *   - deactivated account   -> a "your account is deactivated" screen
 * The database rules (RLS) are the real protection; this just keeps people
 * from landing on screens that would only show errors for them.
 */
export default function AppShell({ role, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoadingAuth, isAuthenticated, logout } = useAuth();

  const userRole = roleOf(user);
  const allowed = isAuthenticated && userRole === role;

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (userRole !== role) router.replace(homePathFor(user) ?? "/");
  }, [isLoadingAuth, isAuthenticated, userRole, role, user, router]);

  if (isLoadingAuth || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (user?.active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <ShieldOff className="h-6 w-6 text-muted-foreground" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-bold tracking-tight">Account deactivated</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An Admin has turned off this account. Ask your chapter Admin if you think this is a mistake.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-6 text-sm font-semibold text-primary transition-opacity hover:opacity-70"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  const items = navFor(role);
  // The longest nav path that the current URL starts with is the active tab,
  // so /charter/reports/123 highlights "My Reports" rather than "Home".
  const activeTo =
    items
      .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0]?.to ?? null;

  const name = user?.full_name || user?.email || "Account";
  const settingsPath = items.find((item) => item.to.endsWith("/settings"))?.to;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-2">
            <Link href={items[0]?.to ?? "/"} aria-label="RedAid home">
              <RedAidLogo />
            </Link>
            <NotificationBell role={role} placement="sidebar" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {ROLE_LABEL[role]}
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {items.map((item) => {
            const active = item.to === activeTo;
            return (
              <Link
                key={item.to}
                href={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <UserAvatar uri={user?.photo_url} name={name} className="h-9 w-9" textClassName="text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur lg:hidden">
        <Link href={items[0]?.to ?? "/"} aria-label="RedAid home">
          <RedAidLogo className="[&>span:first-child]:h-8 [&>span:first-child]:w-8" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell role={role} placement="topbar" />
          {settingsPath && (
            <Link href={settingsPath} aria-label="Settings" className="rounded-full p-1">
              <UserAvatar uri={user?.photo_url} name={name} className="h-8 w-8" textClassName="text-xs" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Log out"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {items.map((item) => {
            const active = item.to === activeTo;
            return (
              <li key={item.to} className="flex-1">
                <Link
                  href={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
