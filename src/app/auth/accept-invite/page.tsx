"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { createClient } from "@/lib/supabase";

/**
 * Where "You've been invited to RedAid" emails land (Admin → Accounts → Add
 * account without a password).
 *
 * Supabase sends invite links back with the login tokens after a "#" in the
 * address. RedAid's normal login setup only accepts a different link format,
 * so on /reset-password those links looked invalid and invited people could
 * never set a password. This page reads the tokens itself, signs the person in,
 * and sends them on to choose their password.
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    // Remove the tokens from the address bar straight away.
    window.history.replaceState(null, "", window.location.pathname);

    const errorText = hash.get("error_description") ?? query.get("error_description");
    if (errorText) {
      setProblem(errorText.replace(/\+/g, " "));
      return;
    }

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setProblem("This invite link is incomplete.");
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setProblem(error.message);
        else router.replace("/reset-password?welcome=1");
      });
  }, [router]);

  if (problem) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invite link didn't work"
        subtitle="It may have expired or already been used"
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Go to log in
          </Link>
        }
      >
        <p className="text-center text-sm text-foreground">{problem}</p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          If you already set your password, just log in. Otherwise ask your chapter Admin to send a new invite.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={UserPlus} title="Welcome to RedAid" subtitle="Setting up your account">
      <div className="flex flex-col items-center gap-3 py-2 text-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        One moment…
      </div>
    </AuthLayout>
  );
}
