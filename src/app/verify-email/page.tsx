"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import SignUpSteps from "@/components/SignUpSteps";
import { RESEND_COOLDOWN_SECONDS, resendConfirmationEmail } from "@/lib/auth-client";

// Step 2 of 2: "check your inbox". Sign-up is confirmed only by the link in
// the email Supabase sends; this page just says the email is on its way and
// lets people resend it. Clicking the link goes to /auth/callback, which
// confirms the account and sends them to /login to sign in.
//
// Reached right after sign-up (?email=...&sent=1), or from the login page when
// someone tries to log in before confirming (?email=..., no "sent").
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const justSignedUp = params.get("sent") === "1";

  const [email, setEmail] = useState(initialEmail);
  const [editingEmail, setEditingEmail] = useState(!initialEmail);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  // Right after sign-up an email was just sent, so resending waits a minute.
  const [cooldown, setCooldown] = useState(justSignedUp ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!email.trim() || cooldown > 0 || sending) return;
    setError("");
    setNotice("");
    setSending(true);
    const { error: sendError } = await resendConfirmationEmail(email);
    setSending(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setEditingEmail(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice(`We sent a new confirmation email to ${email.trim()}.`);
  };

  return (
    <AuthLayout
      icon={MailCheck}
      title="Check your email"
      subtitle={justSignedUp ? "Your account is almost ready" : "Confirm your email to finish signing up"}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Back to log in
        </Link>
      }
    >
      <SignUpSteps current={2} />

      <div className="space-y-5">
        {editingEmail ? (
          <form onSubmit={resend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email you signed up with</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="h-12 w-full font-medium" disabled={!email.trim() || sending || cooldown > 0}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Send confirmation email (${cooldown}s)`
              ) : (
                "Send confirmation email"
              )}
            </Button>
          </form>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {justSignedUp ? "We sent a confirmation link to" : "Your confirmation link was sent to"}
              </p>
              <p className="mt-1 break-all font-semibold">{email}</p>
            </div>

            <ol className="space-y-3 rounded-xl bg-muted p-4 text-sm">
              {[
                "Open the email from RedAid (check Spam or Promotions too).",
                "Tap the confirmation link in the email.",
                "You'll come back to the login page. Log in with your email and password.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && !error && (
          <div role="status" className="rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {!editingEmail && (
          <div className="space-y-3 text-center text-sm text-muted-foreground">
            <p>
              Didn&apos;t get it?{" "}
              {cooldown > 0 ? (
                <span className="tabular-nums">Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => resend()}
                  disabled={sending}
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Resend email"}
                </button>
              )}
            </p>
            <p>
              Wrong email?{" "}
              <button
                type="button"
                onClick={() => {
                  setEditingEmail(true);
                  setError("");
                  setNotice("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Change it
              </button>
              {" "}or{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                sign up again
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
