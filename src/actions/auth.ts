"use server";

import { createServerSupabaseClient, getSiteOrigin } from "@/lib/supabase-server";
import { friendlyAuthError } from "@/lib/auth-client";

export interface AuthResult {
  data: { user: { id: string; email?: string | null } | null; session: { access_token: string } | null } | null;
  error: { message: string } | null;
}

export interface SignUpResult {
  status: "code_sent" | "signed_in" | "already_registered" | "error";
  message?: string;
  data?: { user: { id: string; email?: string | null } | null; session: { access_token: string } | null } | null;
}

export async function signUp(email: string, password: string, firstName: string, lastName: string): Promise<SignUpResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
        // Where the "Confirm your email" link sends people. /auth/callback
        // confirms the account and opens the login page.
        emailRedirectTo: `${await getSiteOrigin()}/auth/callback?flow=signup`,
      },
    });
    if (error) return { status: "error", message: friendlyAuthError(error.message) };
    if (data.session) return { status: "signed_in" };
    // Supabase doesn't say "email taken" outright (so nobody can probe which
    // emails exist); it returns a user with no identities instead.
    if (data.user && (data.user.identities?.length ?? 0) === 0) return { status: "already_registered" };
    return { status: "code_sent", data };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : "An unexpected error occurred" } };
  }
}

export async function signOut(): Promise<{ error: { message: string } | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string): Promise<{ error: { message: string } | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The reset email's link goes through /auth/callback (which signs the person
    // in with the link's code) and then on to the reset-password page.
    redirectTo: `${await getSiteOrigin()}/auth/callback?next=/reset-password`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: { message: string } | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}
