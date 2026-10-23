"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

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
      },
    });
    if (error) return { status: "error", message: error.message };
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
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  return { error };
}

export async function updatePassword(newPassword: string): Promise<{ error: { message: string } | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}