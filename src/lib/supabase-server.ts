import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/**
 * Server-side Supabase client for Server Actions and Route Handlers.
 * Reads and writes the login cookies on the current request, so a sign-in
 * done on the server is saved in the browser too.
 *
 * Uses getAll/setAll (the cookie methods @supabase/ssr recommends): the
 * session can be split across several cookies (sb-...-auth-token.0, .1),
 * and these handle that correctly.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't set cookies.
            // Safe to ignore: proxy.ts refreshes the session on every request.
          }
        },
      },
    }
  );
}

const isLocalHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.endsWith(".local");

/**
 * The public address of the site: http://localhost:3000 locally,
 * https://<your-site> on Vercel. Used for the links inside emails and for
 * redirects after an email link, so they always come back to the right site.
 *
 * Order:
 *   1. REDIRECT_URL, if set (Vercel → Settings → Environment Variables).
 *      On Vercel a localhost value is ignored: it's almost always a copy of
 *      .env.local, and it would send every email link to localhost.
 *   2. The address the browser used (Origin / X-Forwarded-Host headers).
 *   3. Vercel's own production domain (VERCEL_PROJECT_PRODUCTION_URL).
 */
export async function getSiteOrigin(): Promise<string> {
  const onVercel = !!process.env.VERCEL;

  const configured = process.env.REDIRECT_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("REDIRECT_URL must use http or https");
    }
    if (!(onVercel && isLocalHost(url.hostname))) return url.origin;
    console.warn(`Ignoring REDIRECT_URL=${configured} on Vercel: it points at localhost.`);
  }

  const h = await headers();
  const origin = h.get("origin");
  // Origin can be the literal string "null" (e.g. privacy redirects), so parse carefully.
  const originHost = origin && URL.canParse(origin) ? new URL(origin).hostname : null;
  if (origin && originHost && !(onVercel && isLocalHost(originHost))) return origin;

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && !(onVercel && isLocalHost(host.split(":")[0]))) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (isLocalHost(host.split(":")[0]) ? "http" : "https");
    return `${proto}://${host}`;
  }

  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000";
}
