"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import OtpInput from "@/components/OtpInput";
import SignUpSteps from "@/components/SignUpSteps";
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS, resendSignUpCode, verifySignUpCode } from "@/lib/auth-client";

// Step 2 of 2: type the code Supabase emailed. Reached right after sign-up
// (?email=...&sent=1), or from the login page when someone tries to log in
// before verifying (?email=... without sent, so we offer to send a code).
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [emailLocked, setEmailLocked] = useState(!!params.get("email"));
  const [codeSent, setCodeSent] = useState(params.get("sent") === "1");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(codeSent ? RESEND_COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || verifying) return;
    setError("");
    setNotice("");
    setVerifying(true);
    const { error: verifyError } = await verifySignUpCode(email, value);
    if (verifyError) {
      setVerifying(false);
      setError(verifyError);
      setCode("");
      return;
    }
    setVerified(true);
    // Short pause so the success state is visible, then into the app.
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  };

  const sendCode = async () => {
    if (!email.trim() || cooldown > 0 || sending) return;
    setError("");
    setNotice("");
    setSending(true);
    const { error: sendError } = await resendSignUpCode(email);
    setSending(false);
    if (sendError) {
      setError(sendError);
      return;
    }
    setEmailLocked(true);
    setCodeSent(true);
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice(`A new code is on its way to ${email.trim()}.`);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (codeSent) verify(code);
    else sendCode();
  };

  if (verified) {
    return (
      <AuthLayout icon={CheckCircle2} title="Email verified" subtitle="Your account is ready">
        <div className="flex flex-col items-center gap-3 py-2 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Taking you to RedAid...
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={MailCheck}
      title="Check your email"
      subtitle={codeSent ? `Enter the code we sent or click the confirmation link` : "Verify your email to finish signing up"}
      footer={
        <Link href="/signup" className="font-medium text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Back to sign up
        </Link>
      }
    >
      <SignUpSteps current={2} />

      <form onSubmit={onSubmit} className="space-y-5">
        {emailLocked ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium">{email}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setEmailLocked(false);
                setCodeSent(false);
                setCode("");
                setError("");
                setNotice("");
              }}
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
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
        )}

        {codeSent && (
          <div className="space-y-3">
            <OtpInput
              length={OTP_LENGTH}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError("");
              }}
              onComplete={verify}
              disabled={verifying}
              invalid={!!error}
              autoFocus
            />
            <p className="text-center text-xs text-muted-foreground">
              Can&apos;t find it? Check your spam folder. You can also click the confirmation link in the email if you received one instead of a code.
            </p>
          </div>
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

        {codeSent ? (
          <>
            <Button type="submit" className="h-12 w-full font-medium" disabled={code.length !== OTP_LENGTH || verifying}>
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Didn&apos;t get the email?{" "}
              {cooldown > 0 ? (
                <span className="tabular-nums">Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending}
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Resend email"}
                </button>
              )}
            </p>
          </>
        ) : (
          <Button type="submit" className="h-12 w-full font-medium" disabled={!email.trim() || sending || cooldown > 0}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : cooldown > 0 ? (
              `Send code (${cooldown}s)`
            ) : (
              "Send me a code"
            )}
          </Button>
        )}
      </form>
    </AuthLayout>
  );
}
