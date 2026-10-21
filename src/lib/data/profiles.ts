import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type { DutyRole } from "@/types/auth";
import type { Profile } from "@/types/domain";

const STAFF_ROLES: DutyRole[] = ["team_leader", "charter"];

export async function countActiveStaff(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .in("duty_role", STAFF_ROLES);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ListStaffParams {
  role?: DutyRole;
  search?: string;
}

export async function listStaff({ role, search }: ListStaffParams = {}): Promise<Profile[]> {
  const supabase = createClient();
  let q = supabase
    .from("profiles")
    .select("*")
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(500);
  q = role ? q.eq("duty_role", role) : q.in("duty_role", STAFF_ROLES);

  const term = search ? sanitizeSearch(search) : "";
  if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

export async function setAccountActive(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the account — you may not have permission.");
  }
}
