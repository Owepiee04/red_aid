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

/**
 * The address the site is being served from (http://localhost:3000 locally,
 * https://<your-site> on Vercel). Used to build the links inside emails, so
 * they always point back at the site the person signed up on.
 */
export async function getSiteOrigin(): Promise<string> {
  const configuredOrigin = process.env.REDIRECT_URL;
  if (configuredOrigin) {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("REDIRECT_URL must use http or https");
    }
    return url.origin;
  }

  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";
}
