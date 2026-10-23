import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient, getSiteOrigin } from "@/lib/supabase-server";

const EMAIL_LINK_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/** Only allow redirects to pages on this site ("/charter", not "https://evil.com" or "//evil.com"). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export interface EmailLinkOptions {
  /** Sign-up confirmation: confirm the account, don't keep a session, go to /login?confirmed=1. */
  signup?: boolean;
  /** Where to go after signing in from a non-sign-up link (falls back to ?next=, then "/"). */
  next?: string;
}

/**
 * Shared handler for every link in a Supabase email. The routes that use it
 * have no query string of their own (/auth/confirm, /auth/reset), because
 * Supabase only honours a redirect address that matches its "Redirect URLs"
 * list, and an address with "?..." on the end can fail that match. When it
 * fails, Supabase sends people to the "Site URL" instead (which is how links
 * ended up on localhost).
 *
 * Sign-up confirmation:
 *   - Supabase's default link ({{ .ConfirmationURL }}) confirms the email on
 *     Supabase's side before redirecting here with ?code=, so the code isn't
 *     needed. That also makes it work on a different device.
 *   - A token_hash link ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email)
 *     is confirmed here with verifyOtp.
 * Other links (password reset, invites): sign the person in, then continue.
 */
export async function handleEmailLink(request: NextRequest, options: EmailLinkOptions = {}) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isSignup = options.signup ?? false;
  // Password-reset links must end on the reset page even without ?next=.
  const next = type === "recovery" ? "/reset-password" : options.next ?? safeNext(searchParams.get("next"));

  // The public address of the site (REDIRECT_URL in production), so we never
  // bounce people to an internal or local host.
  const base = await getSiteOrigin();

  const fail = () => {
    // Supabase puts its own error (e.g. "Email link is invalid or has expired")
    // in the URL when the link was already used or expired.
    const errorUrl = new URL(`${base}/auth/auth-code-error`);
    const reason = searchParams.get("error_description");
    if (reason) errorUrl.searchParams.set("reason", reason);
    return NextResponse.redirect(errorUrl);
  };

  if (searchParams.get("error")) return fail();

  const supabase = await createServerSupabaseClient();

  if (isSignup) {
    if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return fail();
      // verifyOtp also logs the person in; drop that session so they log in themselves.
      await supabase.auth.signOut({ scope: "local" });
    } else if (!code) {
      return fail();
    }
    return NextResponse.redirect(`${base}/login?confirmed=1`);
  }

  let ok = false;
  if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  return ok ? NextResponse.redirect(`${base}${next}`) : fail();
}
