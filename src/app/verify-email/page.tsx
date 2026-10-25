"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import SignUpSteps from "@/components/SignUpSteps";
import { RESEND_COOLDOWN_SECONDS, changeSignupEmail, resendConfirmationEmail } from "@/lib/auth-client";

// Step 2 of 2: "check your inbox". Sign-up is confirmed only by the link in
// the email Supabase sends; this page says the email is on its way, lets
// people resend it, and lets them fix a mistyped email. Clicking the link goes
// to /auth/confirm, which confirms the account and sends them to /login.
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

type Mode =
  | "inbox" // we know the email: show it, with Resend / Change it
  | "change" // fixing a mistyped email (needs their password)
  | "lookup"; // we don't know the email: ask for it to resend

const emailIcon = (
  <Mail
    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    aria-hidden="true"
  />
);

function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const justSignedUp = params.get("sent") === "1";

  const [email, setEmail] = useState(initialEmail);
  const [mode, setMode] = useState<Mode>(initialEmail ? "inbox" : "lookup");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<React.ReactNode>("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Right after sign-up an email was just sent, so resending waits a minute.
  const [cooldown, setCooldown] = useState(justSignedUp ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const resend = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!email.trim() || cooldown > 0 || busy) return;
    clearMessages();
    setBusy(true);
    const { error: sendError } = await resendConfirmationEmail(email);
    setBusy(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setMode("inbox");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    // Supabase answers "OK" even when no pending sign-up has this email (so
    // nobody can probe which emails exist), so don't claim more than we know.
    setNotice(`If ${email.trim()} is waiting for confirmation, a new link is on its way.`);
  };

  const change = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    clearMessages();
    setBusy(true);
    const result = await changeSignupEmail(email, newEmail, password);
    setBusy(false);
    if ("error" in result) {
      if (result.code === "already_confirmed" || result.code === "email_taken") {
        setError(
          <>
            {result.error}{" "}
            <Link href="/login" className="font-semibold underline">
              Go to log in
            </Link>
          </>
        );
      } else {
        setError(result.error);
      }
      return;
    }
    setEmail(result.email);
    setPassword("");
    setNewEmail("");
    setMode("inbox");
    // Keep the address bar in step, so a refresh still shows the right email.
    router.replace(`/verify-email?email=${encodeURIComponent(result.email)}`);
    if (result.sent) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice(`Email changed. We sent a new confirmation link to ${result.email}.`);
    } else {
      setNotice(result.warning ?? `Email changed to ${result.email}.`);
    }
  };

  const messages = (
    <>
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
    </>
  );

  return (
    <AuthLayout
      icon={MailCheck}
      title={mode === "change" ? "Fix your email" : "Check your email"}
      subtitle={
        mode === "change"
          ? "We'll move your sign-up to the right address"
          : justSignedUp
            ? "Your account is almost ready"
            : "Confirm your email to finish signing up"
      }
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Back to log in
        </Link>
      }
    >
      <SignUpSteps current={2} />

      <div className="space-y-5">
        {mode === "change" && (
          <form onSubmit={change} className="space-y-4">
            <div className="rounded-xl bg-muted px-4 py-3 text-sm">
              <p className="text-muted-foreground">You signed up with</p>
              <p className="mt-0.5 break-all font-semibold">{email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Correct email</Label>
              <div className="relative">
                {emailIcon}
                <Input
                  id="new-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password you just chose</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="To prove it's yours"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {messages}
            <Button type="submit" className="h-12 w-full font-medium" disabled={!newEmail.trim() || !password || busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change email and send link"
              )}
            </Button>
            <button
              type="button"
              onClick={() => {
                clearMessages();
                setMode("inbox");
              }}
              className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </form>
        )}

        {mode === "lookup" && (
          <form onSubmit={resend} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email you signed up with</Label>
              <div className="relative">
                {emailIcon}
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
            {messages}
            <Button type="submit" className="h-12 w-full font-medium" disabled={!email.trim() || busy || cooldown > 0}>
              {busy ? (
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
        )}

        {mode === "inbox" && (
          <>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {justSignedUp || notice ? "We sent a confirmation link to" : "Your confirmation link was sent to"}
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

            {messages}

            <div className="space-y-3 text-center text-sm text-muted-foreground">
              <p>
                Didn&apos;t get it?{" "}
                {cooldown > 0 ? (
                  <span className="tabular-nums">Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => resend()}
                    disabled={busy}
                    className="font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {busy ? "Sending..." : "Resend email"}
                  </button>
                )}
              </p>
              <p>
                Typed the wrong email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setMode("change");
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  Change it
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
