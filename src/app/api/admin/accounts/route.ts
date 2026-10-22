import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Runs ONLY on the server. SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix on
// purpose: that is what keeps it out of the browser. Never rename it to add one.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUTY_ROLES = ["team_leader", "charter"] as const;
type DutyRole = (typeof DUTY_ROLES)[number];

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return fail("The server isn't configured for creating accounts (SUPABASE_SERVICE_ROLE_KEY is missing).", 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Who is calling? Verify their login token with Supabase.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Not signed in.", 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return fail("Your session has expired. Please log in again.", 401);

  // 2. Are they an admin? (read from the database, never trusted from the browser)
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (profile?.role !== "admin") return fail("Only admins can create accounts.", 403);

  // 3. Validate the request.
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" && body.password !== "" ? body.password : undefined;
  const dutyRole = body?.dutyRole as DutyRole;

  if (!EMAIL.test(email)) return fail("Enter a valid email address.", 400);
  if (!DUTY_ROLES.includes(dutyRole)) return fail("Choose Team Leader or Charter.", 400);
  if (password !== undefined && password.length < 8) {
    return fail("A temporary password must be at least 8 characters.", 400);
  }

  // 4. Create the login: either with a password (no email) or by emailing an invite.
  const metadata = { full_name: name };
  const created = password
    ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata })
    : await admin.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        // Lands on the page that lets them choose a password.
        redirectTo: `${new URL(request.url).origin}/reset-password`,
      });

  if (created.error || !created.data.user) {
    const message = created.error?.message ?? "Couldn't create the account.";
    const exists = /already|registered|exists/i.test(message);
    return fail(exists ? "An account with that email already exists." : message, exists ? 409 : 400);
  }

  // 5. Create their profile (role + duty role). If this fails, undo the login so we
  //    don't leave a half-made account that blocks retrying the same email.
  const userId = created.data.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name: name || null,
    role: "user",
    duty_role: dutyRole,
    active: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return fail(`Couldn't save the profile: ${profileError.message}`, 500);
  }

  return NextResponse.json({ id: userId, invited: !password });
}
