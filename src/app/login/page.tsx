"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import { signIn } from "@/actions/auth";
import { isAccountBanned, isEmailNotConfirmed } from "@/lib/auth-client";

// People create their own account at /signup and confirm it with the link
// Supabase emails them; the link brings them back here with ?confirmed=1.
// Logging in before confirming points them to /verify-email to resend it.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ReactNode>("");
  const [loading, setLoading] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  // Read ?confirmed=1 after the page loads (no useSearchParams, so the page can
  // stay static without a Suspense wrapper).
  useEffect(() => {
    setJustConfirmed(new URLSearchParams(window.location.search).get("confirmed") === "1");
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError && isEmailNotConfirmed(signInError.message)) {
      setError(
        <>
          You haven&apos;t confirmed this email yet. Tap the link in the email we sent you, or{" "}
          <Link
            href={`/verify-email?email=${encodeURIComponent(email.trim())}`}
            className="font-semibold underline"
          >
            send it again
          </Link>
          .
        </>
      );
      setLoading(false);
      return;
    }

    if (signInError && isAccountBanned(signInError.message)) {
      setError("This account has been deactivated. Ask your chapter Admin if you think this is a mistake.");
      setLoading(false);
      return;
    }

    if (signInError) {
      setError("Incorrect email or password");
      setLoading(false);
      return;
    }

    // Server action sets the session cookie; full navigation picks it up.
    window.location.href = "/";
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          New to RedAid?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {justConfirmed && !error && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Your email is confirmed. Log in with your email and password.</span>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
