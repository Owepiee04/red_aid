"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, User, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import SignUpSteps from "@/components/SignUpSteps";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-client";
import { signUp } from "@/actions/auth";
import { cn } from "@/lib/utils";

// Step 1 of 2: create the account. Supabase then emails a confirmation link,
// and step 2 (/verify-email) tells the person to check their inbox. The link
// confirms the account and brings them to /login. Everyone who signs up
// starts as a First Aider; Admins are promoted directly in the database.
export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ReactNode>("");
  const [loading, setLoading] = useState(false);

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  const hasLetterAndNumber = /[a-z]/i.test(password) && /\d/.test(password);
  const matches = confirm.length > 0 && confirm === password;
  const canSubmit =
    firstName.trim() && lastName.trim() && email.trim() && longEnough && hasLetterAndNumber && matches && !loading;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    const result = await signUp(email, password, firstName, lastName);
    if (result.status === "code_sent") {
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
      return;
    }

    if (result.status === "signed_in") {
      // Full page load so the new login cookie is sent with the request.
      window.location.href = "/";
      return;
    }
    setLoading(false);
    if (result.status === "already_registered") {
      setError(
        <>
          An account with this email already exists.{" "}
          <Link href="/login" className="font-semibold underline">
            Log in instead
          </Link>
          .
        </>
      );
      return;
    }
    setError(result.message);
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Join your Red Cross Youth duty team"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignUpSteps current={1} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="first-name"
                autoComplete="given-name"
                autoFocus
                placeholder="Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={60}
                className="h-12 pl-10"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              autoComplete="family-name"
              placeholder="Dela Cruz"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={60}
              className="h-12"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">We&apos;ll email you a link to confirm it&apos;s you.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-rules"
            required
          />
          <ul id="password-rules" className="space-y-1 pt-1 text-xs">
            <Rule ok={longEnough}>At least {MIN_PASSWORD_LENGTH} characters</Rule>
            <Rule ok={hasLetterAndNumber}>Has a letter and a number</Rule>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Type it again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirm.length > 0 && !matches}
            required
          />
          {confirm.length > 0 && !matches && (
            <p className="text-xs text-destructive">Passwords don&apos;t match yet.</p>
          )}
        </div>

        <Button type="submit" className="h-12 w-full font-medium" disabled={!canSubmit}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5 transition-colors", ok ? "text-emerald-600" : "text-muted-foreground")}>
      {ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
      <span className="sr-only">{ok ? "(done)" : "(not yet)"}</span>
    </li>
  );
}
