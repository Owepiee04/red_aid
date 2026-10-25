import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Activate / deactivate an account. Runs ONLY on the server (service-role key).
//
// Deactivating does two things:
//   1. users.is_active = false: the database's "Active accounts only" rules
//      stop the account reading or changing anything straight away.
//   2. Bans the login in Supabase Auth, so the person can't log in again or
//      refresh their session. Activating lifts the ban.

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
// Supabase has no "forever" ban; ~100 years is the usual stand-in.
const BAN_FOREVER = "876000h";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return fail("The server isn't configured for managing accounts (SUPABASE_SERVICE_ROLE_KEY is missing).", 500);
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Who is calling, and are they an active platform admin? (checked here, never trusted from the browser)
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Not signed in.", 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return fail("Your session has expired. Please log in again.", 401);
  const { data: callerRow } = await admin
    .from("users")
    .select("is_admin, is_active")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (!callerRow?.is_admin || !callerRow.is_active) return fail("Only admins can change account status.", 403);

  const body = (await request.json().catch(() => null)) as { id?: unknown; active?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const active = body?.active;
  if (!id || typeof active !== "boolean") return fail("Send the account id and active: true or false.", 400);
  if (id === caller.user.id && !active) return fail("You can't deactivate your own account.", 400);

  const { data: updated, error: rowError } = await admin
    .from("users")
    .update({ is_active: active })
    .eq("id", id)
    .select("id");
  if (rowError) return fail(rowError.message, 500);
  if (!updated || updated.length === 0) return fail("Account not found.", 404);

  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (banError) {
    // Keep the two in step: undo the is_active change if the login couldn't be (un)banned.
    await admin.from("users").update({ is_active: !active }).eq("id", id);
    return fail(`Couldn't ${active ? "reactivate" : "block"} the login: ${banError.message}`, 500);
  }

  return NextResponse.json({ id, active });
}
