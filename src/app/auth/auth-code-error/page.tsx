"use client";

import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "@/components/AuthLayout";
import { createClient } from "@/lib/supabase";

export default function AuthCodeErrorPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Sometimes the callback redirects here even though the session was
    // actually established. Check for an existing session before showing
    // the error.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/");
      } else {
        setChecked(true);
      }
    });
  }, [router]);

  if (!checked) {
    return (
      <AuthLayout icon={Loader2} title="Checking session..." subtitle="Please wait">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={AlertCircle}
      title="Could not verify email"
      subtitle="The confirmation link appears to be invalid or has expired"
      footer={
        <Link href="/verify-email" className="text-primary font-medium hover:underline">
          Send a new confirmation email
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        We couldn&apos;t complete the email verification. This can happen if the link
        has already been used or has expired.
      </p>
      <p className="mt-2 text-sm text-foreground text-center">
        If you already confirmed, just log in. Otherwise, send a new confirmation email and use the link in the newest one.
      </p>
    </AuthLayout>
  );
}
