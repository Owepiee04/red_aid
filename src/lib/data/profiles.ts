import { createClient } from "@/lib/supabase";
import { listUsers } from "@/lib/data/users";
import type { DutyRole } from "@/types/auth";
import type { Profile, UserRecord } from "@/types/domain";

const STAFF_ROLES: DutyRole[] = ["team_leader", "charter"];

function fullNameOf(user: UserRecord): string {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

function toProfile(user: UserRecord): Profile {
  return {
    id: user.id,
    email: "",
    full_name: fullNameOf(user) || null,
    role: user.is_admin ? "admin" : "user",
    duty_role: user.duty_role,
    active: user.is_active,
    photo_url: user.pfp_img_url,
    created_at: user.created_at,
  };
}

export async function countActiveStaff(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ListStaffParams {
  role?: DutyRole;
  search?: string;
}

export async function listStaff({ role, search }: ListStaffParams = {}): Promise<Profile[]> {
  const users = await listUsers({ search });
  return users
    .map(toProfile)
    .filter((profile) =>
      role ? profile.duty_role === role : profile.duty_role !== null && STAFF_ROLES.includes(profile.duty_role)
    );
}

export async function getProfile(id: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data as UserRecord) : null;
}

export async function setAccountActive(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ is_active: active })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the account — you may not have permission.");
  }
}

/**
 * Changes someone's default duty role (Team Leader or Charter). Only platform
 * admins can: the "Platform admins can manage users" policy allows the update
 * and the protect_user_privileges trigger blocks everyone else.
 */
export async function setDutyRole(id: string, dutyRole: DutyRole): Promise<void> {
  if (!STAFF_ROLES.includes(dutyRole)) throw new Error("Choose Team Leader or Charter.");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .update({ duty_role: dutyRole })
    .eq("id", id)
    .select("id, duty_role");
  if (error) {
    throw new Error(/roles or account status/i.test(error.message) ? "Only admins can change roles." : error.message);
  }
  if (!data || data.length === 0) {
    throw new Error("Couldn't change the role — you may not have permission.");
  }
}
