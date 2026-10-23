import { createClient } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

// Auth helpers used by the login, sign-up, verify-email and password pages.
//
// These run in the BROWSER on purpose (this file used to start with
// "use server"). Supabase keeps the login session in the browser's cookies;
// when signIn ran as a server action, the session was created on the server
// and never reached the browser, so a "successful" login still looked
// signed out.

export interface AuthResult {
  data: { user: { id: string; email?: string | null } | null; session: { access_token: string } | null } | null;
  error: { message: string } | null;
}

/** Length of the email code. Must match Supabase → Authentication → Providers → Email → "Email OTP Length". */
export const OTP_LENGTH = 6;
/** Seconds to wait before "Resend code" works again (Supabase also rate-limits resends). */
export const RESEND_COOLDOWN_SECONDS = 60;
export const MIN_PASSWORD_LENGTH = 8;

export interface SignUpDetails {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export type SignUpOutcome =
  /** Account created; a code was emailed. Go to the verify step. */
  | { status: "code_sent", data : {user : User, session : Session | null} }
  /** Email confirmation is turned off in Supabase, so the user is already signed in. */
  | { status: "signed_in" }
  /** This email already has a confirmed account. */
  | { status: "already_registered" }
  | { status: "error"; message: string };

/**
 * Creates the account and makes Supabase email a one-time code.
 * first_name / last_name ride along as user metadata; the database side
 * (a trigger on auth.users) can copy them into the users table.
 */
export async function signUp({ firstName, lastName, email, password }: SignUpDetails): Promise<SignUpOutcome> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password : password,
    options: {
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    },
  });
  if (error) return { status: "error", message: friendlyAuthError(error.message) };
  if (data.session) return { status: "signed_in" };
  // Supabase doesn't say "email taken" outright (so nobody can probe which
  // emails exist); it returns a user with no identities instead.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { status: "already_registered" };
  return { status: "code_sent", data : data };
}

/** Checks the emailed code. On success the user is signed in. */
export async function verifySignUpCode(email: string, code: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "signup" });
  return { error: error ? friendlyAuthError(error.message) : null };
}

/** Emails a fresh sign-up code. */
export async function resendSignUpCode(email: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
  return { error: error ? friendlyAuthError(error.message) : null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut(): Promise<{ error: { message: string } | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string): Promise<{ error: { message: string } | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: { message: string } | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

/** True when Supabase refused a login because the email hasn't been verified yet. */
export function isEmailNotConfirmed(message: string | undefined | null): boolean {
  return !!message && /email not confirmed/i.test(message);
}

/** Turns Supabase's error text into something a first aider can act on. */
export function friendlyAuthError(message: string): string {
  if (/expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(message)) {
    return "That code is wrong or has expired. Check the latest email, or send a new code.";
  }
  if (/rate limit|too many|for security purposes/i.test(message)) {
    return "Too many tries. Please wait a minute and try again.";
  }
  if (/password should be|weak password/i.test(message)) {
    return `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`;
  }
  if (/invalid email|unable to validate email/i.test(message)) {
    return "That email address doesn't look right.";
  }
  if (/signups? not allowed|signup.*disabled/i.test(message)) {
    return "Sign-ups are turned off right now. Ask your chapter Admin.";
  }
  if (/error sending.*email/i.test(message)) {
    return "We couldn't send the email. Please try again in a minute.";
  }
  return message;
}
