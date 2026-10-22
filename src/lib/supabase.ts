import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Call this inside client components
 * (anything marked "use client") — it reads the public URL and anon key
 * from env vars that must be exposed to the browser, hence the
 * NEXT_PUBLIC_ prefix.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
