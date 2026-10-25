import { createClient } from "@/lib/supabase";
import type {
  DutyHistoryItem,
  EventDetail,
  EventMemberRow,
  EventPerson,
  EventRecord,
  EventRow,
  MemberRole,
  MyEvent,
  UserRecord,
} from "@/types/domain";
import type { DutyRole } from "@/types/auth";
import { isChartingOpen } from "@/lib/duty";
import { dutyRoleToMemberRole, memberRoleToDutyRole, verifyCharter, unverifyCharter } from "@/lib/data/eventMembers";

type NamedUser = Pick<UserRecord, "id" | "first_name" | "last_name" | "pfp_img_url">;

function fullNameOf(user: NamedUser | null | undefined): string | null {
  if (!user) return null;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return name || null;
}

function dateParts(iso: string): { date: string; time: string | null } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: iso.length > 10 ? iso.slice(11, 19) : null };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:00`,
  };
}

function toEventRow(event: EventRecord): EventRow {
  const { date, time } = dateParts(event.event_date);
  return {
    id: event.id,
    title: event.name,
    date,
    time,
    location: event.location,
    description: event.description,
    created_by: event.created_by,
    ended_at: event.ended_at ?? null,
    ended_by: event.ended_by ?? null,
    created_at: event.created_at,
    updated_at: event.updated_at,
    name: event.name,
    is_deleted: event.is_deleted,
    is_exported: event.is_exported,
  };
}

export async function countEventsInRange(start: string, end: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("is_deleted", false)
    .gte("event_date", `${start}T00:00:00`)
    .lte("event_date", `${end}T23:59:59.999`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listEventsInRange(start: string, end: string): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_deleted", false)
    .gte("event_date", `${start}T00:00:00`)
    .lte("event_date", `${end}T23:59:59.999`)
    .order("event_date", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRecord[]).map(toEventRow);
}

export async function listEventOptions(limit = 100): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_deleted", false)
    .order("event_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRecord[]).map(toEventRow);
}

type RawEventMember = EventMemberRow & { user: NamedUser | null };

export async function getEvent(id: string): Promise<EventDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `*,
       event_members(*, user:users!event_members_user_id_fkey(id, first_name, last_name, pfp_img_url))`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { event_members, ...event } = data as EventRecord & { event_members: RawEventMember[] };
  const toPerson = (member: RawEventMember): EventPerson => ({
    user_id: member.user_id,
    name: fullNameOf(member.user),
    photo_url: member.user?.pfp_img_url ?? null,
    verified: member.is_verified,
  });
  const byName = (a: EventPerson, b: EventPerson) => (a.name ?? "").localeCompare(b.name ?? "");
  const members = event_members ?? [];
  const isLeader = (role: MemberRole) => role === "TL" || role === "Admin";
  const isCharter = (role: MemberRole) => role === "Charter" || role === "First Aider";

  return {
    ...toEventRow(event),
    team_leaders: members.filter((m) => isLeader(m.member_role)).map(toPerson).sort(byName),
    charters: members.filter((m) => isCharter(m.member_role)).map(toPerson).sort(byName),
  };
}

export async function listDutyHistory(userId: string): Promise<DutyHistoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("member_role, event:events!event_members_event_id_fkey(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as { member_role: MemberRole; event: EventRecord | null }[])
    .filter((row): row is { member_role: MemberRole; event: EventRecord } => row.event !== null)
    .filter((row) => !row.event.is_deleted)
    .map((row) => ({
      event: toEventRow(row.event),
      dutyRole: memberRoleToDutyRole(row.member_role) ?? "charter",
    }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date))
    .slice(0, 50);
}

type RawMembershipEvent = EventMemberRow & { event: EventRecord | null };

export interface ListMyEventsParams {
  userId: string;
  dutyRole?: DutyRole;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listMyEvents({
  userId,
  dutyRole = "charter",
  from,
  to,
  limit = 100,
}: ListMyEventsParams): Promise<MyEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("*, event:events!event_members_event_id_fkey(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const wantedRole = dutyRoleToMemberRole(dutyRole);
  const allowed: MemberRole[] =
    wantedRole === "TL" ? ["TL", "Admin"] : ["Charter", "First Aider"];

  return ((data ?? []) as unknown as RawMembershipEvent[])
    .filter((row): row is RawMembershipEvent & { event: EventRecord } => row.event !== null)
    .filter((row) => !row.event.is_deleted && allowed.includes(row.member_role))
    .map((row) => {
      const event = toEventRow(row.event);
      if (from && event.date < from) return null;
      if (to && event.date > to) return null;
      return { ...event, verified: row.is_verified } satisfies MyEvent;
    })
    .filter((event): event is MyEvent => event !== null)
    .sort((a, b) => `${a.date}T${a.time ?? "00:00"}`.localeCompare(`${b.date}T${b.time ?? "00:00"}`))
    .slice(0, limit);
}

export async function getTodaysDuty(
  userId: string,
  today: string,
  dutyRole: DutyRole = "charter"
): Promise<MyEvent | null> {
  const events = await listMyEvents({ userId, dutyRole, from: today, to: today, limit: 5 });
  return events.find((e) => isChartingOpen(e)) ?? events.find((e) => e.verified) ?? events[0] ?? null;
}

export async function setCharterVerified(eventId: string, userId: string, verified: boolean): Promise<void> {
  if (verified) await verifyCharter(eventId, userId);
  else await unverifyCharter(eventId, userId);
}

export interface SaveEventInput {
  id?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  teamLeaderIds: string[];
  charterIds: string[];
}

function toTimestamp(date: string, time: string): string {
  const stamp = new Date(`${date}T${time || "00:00"}:00`);
  if (Number.isNaN(stamp.getTime())) throw new Error("That event date or time isn't valid.");
  return stamp.toISOString();
}

async function syncMembers(
  eventId: string,
  desired: Map<string, MemberRole>
): Promise<void> {
  const supabase = createClient();
  const { data: existing, error } = await supabase
    .from("event_members")
    .select("*")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);

  const current = (existing ?? []) as EventMemberRow[];
  const currentIds = new Set(current.map((m) => m.user_id));

  for (const member of current) {
    const wanted = desired.get(member.user_id);
    if (!wanted) {
      const { error: deleteError } = await supabase
        .from("event_members")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", member.user_id);
      if (deleteError) throw new Error(deleteError.message);
      continue;
    }
    if (member.member_role !== wanted) {
      const { error: updateError } = await supabase
        .from("event_members")
        .update({ member_role: wanted, is_verified: false, verified_by: null, verified_at: null })
        .eq("event_id", eventId)
        .eq("user_id", member.user_id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  const missing = [...desired.entries()].filter(([userId]) => !currentIds.has(userId));
  if (missing.length > 0) {
    const { error: insertError } = await supabase.from("event_members").insert(
      missing.map(([user_id, member_role]) => ({ event_id: eventId, user_id, member_role }))
    );
    if (insertError) throw new Error(insertError.message);
  }
}

export async function saveEvent(input: SaveEventInput): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const eventDate = toTimestamp(input.date, input.time);
  let eventId = input.id ?? "";
  let creatorId = user.id;

  if (input.id) {
    const { data, error } = await supabase
      .from("events")
      .update({
        name: input.title.trim(),
        location: input.location.trim(),
        event_date: eventDate,
        description: input.description.trim() || null,
      })
      .eq("id", input.id)
      .select("id, created_by");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Event not found.");
    creatorId = (data[0] as { created_by: string }).created_by;
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: input.title.trim(),
        location: input.location.trim(),
        event_date: eventDate,
        description: input.description.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    eventId = (data as { id: string }).id;
  }

  const desired = new Map<string, MemberRole>();
  if (creatorId) desired.set(creatorId, "Admin");
  for (const id of input.teamLeaderIds) {
    if (!desired.has(id)) desired.set(id, "TL");
  }
  for (const id of input.charterIds) {
    if (!desired.has(id)) desired.set(id, "Charter");
  }

  await syncMembers(eventId, desired);
  return eventId;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ is_deleted: true })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete the event — it may already be gone, or you may not have permission.");
  }
}

/**
 * End Duty: stamps events.ended_at (via the end_event database function, which
 * checks the caller is a platform Admin or the event's TL/Admin and writes the
 * audit log). Charting stays open for CHARTING_GRACE_MINUTES afterwards.
 */
export async function endEvent(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("end_event", { p_event_id: eventId });
  if (error) throw new Error(error.message);
}

/** Reopen Duty: clears ended_at so charting is open again. */
export async function reopenEvent(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("reopen_event", { p_event_id: eventId });
  if (error) throw new Error(error.message);
}

export async function markEventExported(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_event_exported", { p_event_id: eventId });
  if (error) throw new Error(error.message);
}

export async function cleanupExportedEvents(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cleanup_exported_events");
  if (error) throw new Error(error.message);
}
