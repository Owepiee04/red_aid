import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type { UserRecord } from "@/types/domain";

export type { UserRecord };

export function displayName(user: Pick<UserRecord, "first_name" | "last_name"> | null | undefined): string {
  if (!user) return "";
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

export async function listUsers(params: { search?: string; limit?: number } = {}): Promise<UserRecord[]> {
  const { search, limit = 500 } = params;
  const supabase = createClient();
  let q = supabase.from("users").select("*").order("last_name", { ascending: true }).limit(limit);
  const term = search ? sanitizeSearch(search) : "";
  if (term) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as UserRecord[];
}

export async function countUsers(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase.from("users").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserRecord | null) ?? null;
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getUser(user.id);
}

export async function updateMyUserRow(input: {
  first_name: string;
  last_name: string;
  pfp_img_url: string | null;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase
    .from("users")
    .update({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      pfp_img_url: input.pfp_img_url,
    })
    .eq("id", user.id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't save your profile — you may not have permission.");
  }
}
