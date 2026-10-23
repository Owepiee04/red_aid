import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const EMAIL_LINK_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/** Only allow redirects to pages on this site ("/charter", not "https://evil.com" or "//evil.com"). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Where links in Supabase emails land (confirm sign-up, reset password,
 * invites). Signs the person in, saves the session cookie, then sends them on.
 *
 * Two kinds of links are accepted:
 *   ?code=...                    Supabase's default link. Only works in the same browser
 *                                that signed up (it needs a cookie that browser saved).
 *   ?token_hash=...&type=...     Works on any device. Use it by setting the email
 *                                template link to:
 *                                {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Password-reset links must end on the reset page even without ?next=.
  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"));

  // Behind Vercel, request.url can report an internal host; prefer the public
  // one, with the protocol the visitor actually used.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  const supabase = await createServerSupabaseClient();
  let ok = false;

  if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) return NextResponse.redirect(`${base}${next}`);

  // Supabase puts its own error (e.g. "Email link is invalid or has expired")
  // in the URL when the link was already used; pass it along for the error page.
  const reason = searchParams.get("error_description");
  const errorUrl = new URL(`${base}/auth/auth-code-error`);
  if (reason) errorUrl.searchParams.set("reason", reason);
  return NextResponse.redirect(errorUrl);
}
