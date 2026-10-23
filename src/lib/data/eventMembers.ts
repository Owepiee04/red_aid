import { createClient } from "@/lib/supabase";
import type { DutyRole } from "@/types/auth";
import type { EventMemberRow, MemberRole, UserRecord } from "@/types/domain";

export type { EventMemberRow, MemberRole };

export interface EventMemberWithUser extends EventMemberRow {
  user: Pick<UserRecord, "id" | "first_name" | "last_name" | "pfp_img_url"> | null;
}

const MEMBER_SELECT = `
  *,
  user:users!event_members_user_id_fkey(id, first_name, last_name, pfp_img_url)
`;

export function memberRoleToDutyRole(role: MemberRole): DutyRole | null {
  if (role === "TL" || role === "Admin") return "team_leader";
  if (role === "Charter" || role === "First Aider") return "charter";
  return null;
}

export function dutyRoleToMemberRole(role: DutyRole): MemberRole {
  return role === "team_leader" ? "TL" : "Charter";
}

export async function listEventMembers(eventId: string): Promise<EventMemberWithUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select(MEMBER_SELECT)
    .eq("event_id", eventId)
    .order("member_role", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventMemberWithUser[];
}

export async function getEventMember(eventId: string, userId: string): Promise<EventMemberRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventMemberRow | null) ?? null;
}

export async function listUserMemberships(userId: string): Promise<(EventMemberRow & { event: unknown })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("*, event:events!event_members_event_id_fkey(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (EventMemberRow & { event: unknown })[];
}

export async function addEventMember(input: {
  event_id: string;
  user_id: string;
  member_role: MemberRole;
  is_verified?: boolean;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("event_members").insert({
    event_id: input.event_id,
    user_id: input.user_id,
    member_role: input.member_role,
    is_verified: input.is_verified ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function updateEventMember(
  eventId: string,
  userId: string,
  patch: Partial<Pick<EventMemberRow, "member_role" | "is_verified" | "verified_by" | "verified_at">>
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .update(patch)
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the event member — you may not have permission.");
  }
}

export async function removeEventMember(eventId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function verifyCharter(eventId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("verify_charter", { p_event_id: eventId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unverifyCharter(eventId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("unverify_charter", { p_event_id: eventId, p_user_id: userId });
  if (error) throw new Error(error.message);
}
