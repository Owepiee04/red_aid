import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSiteOrigin } from "@/lib/supabase-server";

// Runs ONLY on the server. SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix on
// purpose: that is what keeps it out of the browser. Never rename it to add one.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUTY_ROLES = ["team_leader", "charter"] as const;
type DutyRole = (typeof DUTY_ROLES)[number];

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

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

  // 2. Are they a platform admin? (read from the database, never trusted from the browser)
  const { data: callerRow } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (!callerRow?.is_admin) return fail("Only admins can create accounts.", 403);

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

  const { firstName, lastName } = splitName(name);

  // 4. Create the login: either with a password (no email) or by emailing an invite.
  const metadata = { first_name: firstName, last_name: lastName };
  const created = password
    ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata })
    : await admin.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        // /auth/accept-invite signs them in from the link, then lets them choose a password.
        redirectTo: `${await getSiteOrigin()}/auth/accept-invite`,
      });

  if (created.error || !created.data.user) {
    const message = created.error?.message ?? "Couldn't create the account.";
    const exists = /already|registered|exists/i.test(message);
    return fail(exists ? "An account with that email already exists." : message, exists ? 409 : 400);
  }

  // 5. Make sure the users row carries the chosen default duty role. The signup
  //    trigger already created it; this upsert only fills in the app-level role.
  const userId = created.data.user.id;
  const { error: rowError } = await admin.from("users").upsert({
    id: userId,
    first_name: firstName || "User",
    last_name: lastName,
    duty_role: dutyRole,
  });
  if (rowError) {
    await admin.auth.admin.deleteUser(userId);
    return fail(`Couldn't save the user: ${rowError.message}`, 500);
  }

  return NextResponse.json({ id: userId, invited: !password });
}
