import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient, getSiteOrigin } from "@/lib/supabase-server";

const EMAIL_LINK_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/** Only allow redirects to pages on this site ("/charter", not "https://evil.com" or "//evil.com"). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Where links in Supabase emails land.
 *
 * Sign-up confirmation (?flow=signup, or a token_hash link with type=signup/email):
 *   the account is confirmed, then the person is sent to /login?confirmed=1 to log in
 *   with their email and password. No session is kept, so the login page is what
 *   they actually see.
 *     - Supabase's default link ({{ .ConfirmationURL }}) confirms the email on
 *       Supabase's side before it redirects here with ?code=, so we don't need the
 *       code at all. That also makes it work when the email is opened on a
 *       different phone or computer than the one used to sign up.
 *     - A token_hash link ({{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email)
 *       is confirmed here with verifyOtp.
 *
 * Other links (password reset, invites): sign the person in and continue to ?next=.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isSignupConfirmation = searchParams.get("flow") === "signup" || type === "signup" || type === "email";
  // Password-reset links must end on the reset page even without ?next=.
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"));

  // Use the configured public URL in production so auth links never fall
  // back to an internal or local request host.
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

  if (isSignupConfirmation) {
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
