import { createClient } from "@/lib/supabase";
import type { DutyRole } from "@/types/auth";

export interface CreateAccountInput {
  name: string;
  email: string;
  dutyRole: DutyRole;
  /** Optional. If set, the account is created with this password and NO email is sent. */
  password?: string;
}

/**
 * Creating a login needs Supabase's service-role key, which must never reach the
 * browser — so this calls our own server route (src/app/api/admin/accounts/route.ts),
 * which checks that you're an admin before doing anything.
 */
export async function createAccount(input: CreateAccountInput): Promise<{ id: string; invited: boolean }> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("You're signed out. Please log in again.");

  const response = await fetch("/api/admin/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => ({}))) as { id?: string; invited?: boolean; error?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.error ?? `Couldn't create the account (error ${response.status}).`);
  }
  return { id: body.id, invited: Boolean(body.invited) };
}
