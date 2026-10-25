import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { getSiteOrigin } from "@/lib/supabase-server";

// "Wrong email? Change it" on /verify-email (issue #23).
//
// A sign-up with a mistyped email creates an unconfirmed account under the wrong
// address, and Supabase's "resend" only works for an existing account, so
// resending to the corrected address silently did nothing. This route moves the
// still-unconfirmed account to the new address and sends the confirmation there.
//
// Safety: the person must give the password they signed up with. Supabase only
// answers "Email not confirmed" when the password is right, so that proves the
// account is theirs and still unconfirmed. Without this check anyone could
// redirect someone else's pending sign-up to their own inbox.
// Runs ONLY on the server (service-role key).

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, code }, { status });

type ListUsers = (params: { page: number; perPage: number }) => Promise<{
  data: { users: User[] };
  error: { message: string } | null;
}>;

async function findUserByEmail(listUsers: ListUsers, email: string): Promise<User | null> {
  // The admin API has no "get by email", so page through the (small) user list.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return fail("The server isn't configured for this (SUPABASE_SERVICE_ROLE_KEY is missing).", 500);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const oldEmail = typeof body?.oldEmail === "string" ? body.oldEmail.trim().toLowerCase() : "";
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL.test(oldEmail) || !password) return fail("Enter the password you signed up with.", 400);
  if (!EMAIL.test(newEmail)) return fail("That new email address doesn't look right.", 400);
  if (newEmail === oldEmail) return fail("That's the same email. Use Resend instead.", 400);

  const auth = { autoRefreshToken: false, persistSession: false };
  const anon = createClient(url, anonKey, { auth });
  const admin = createClient(url, serviceKey, { auth });

  // 1. Is the password right, and is the account still unconfirmed?
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: oldEmail,
    password,
  });
  if (signIn?.session) {
    await anon.auth.signOut().catch(() => {});
    return fail("That account is already confirmed. Log in instead.", 409, "already_confirmed");
  }
  const message = signInError?.message ?? "";
  if (/rate limit|too many|for security purposes/i.test(message)) {
    return fail("Too many tries. Please wait a minute and try again.", 429);
  }
  if (!/email not confirmed/i.test(message)) {
    return fail("That password doesn't match the account you signed up with.", 401, "wrong_password");
  }

  try {
    // 2. Find both accounts.
    const listUsers: ListUsers = async (p) => {
      const { data, error } = await admin.auth.admin.listUsers(p);
      return { data: { users: (data?.users ?? []) as User[] }, error };
    };
    const account = await findUserByEmail(listUsers, oldEmail);
    if (!account || account.email_confirmed_at) {
      return fail("We couldn't find a pending sign-up for that email.", 404);
    }
    if (await findUserByEmail(listUsers, newEmail)) {
      return fail("An account already uses that email. Log in, or use a different email.", 409, "email_taken");
    }

    // 3. Move the account to the new email (it stays unconfirmed).
    const { error: updateError } = await admin.auth.admin.updateUserById(account.id, { email: newEmail });
    if (updateError) return fail(`Couldn't change the email: ${updateError.message}`, 400);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.", 500);
  }

  // 4. Send the confirmation to the new address.
  const { error: resendError } = await anon.auth.resend({
    type: "signup",
    email: newEmail,
    options: { emailRedirectTo: `${await getSiteOrigin()}/auth/confirm` },
  });
  if (resendError) {
    const tooSoon = /rate limit|for security purposes/i.test(resendError.message);
    return NextResponse.json({
      email: newEmail,
      sent: false,
      warning: tooSoon
        ? "Your email was changed. Wait a minute, then tap Resend to get the confirmation link."
        : `Your email was changed, but the confirmation email didn't send: ${resendError.message}`,
    });
  }

  return NextResponse.json({ email: newEmail, sent: true });
}
