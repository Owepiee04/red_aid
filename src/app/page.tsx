"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { homePathFor } from "@/lib/roles";
import RedAidLogo from "@/components/RedAidLogo";

// Converted from RoleHome.jsx. Every login lands here first, and this
// page routes onward once the profile has loaded: signed out -> /login,
// a role we recognize -> that role's dashboard, no duty_role yet ->
// the "waiting for an Admin to assign you" screen below.
export default function RoleHomePage() {
  const router = useRouter();
  const { user, isLoadingAuth, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    const path = homePathFor(user);
    if (path) router.replace(path);
  }, [isLoadingAuth, isAuthenticated, user, router]);

  const willRedirect = isLoadingAuth || (isAuthenticated && !!homePathFor(user));
  if (willRedirect) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <RedAidLogo className="justify-center" />
        <h1 className="mt-6 font-heading text-xl font-bold tracking-tight">
          Your account is being set up
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An admin still needs to assign you a duty role — Team Leader or Charter — before you
          can start charting.
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
