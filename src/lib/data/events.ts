import { createClient } from "@/lib/supabase";
import type { DutyHistoryItem, EventDetail, EventPerson, EventRow, MyEvent } from "@/types/domain";
import type { DutyRole } from "@/types/auth";

export async function countEventsInRange(start: string, end: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .gte("date", start)
    .lte("date", end);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listEventsInRange(start: string, end: string): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

/** Latest events for filter dropdowns. */
export async function listEventOptions(limit = 100): Promise<EventRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

type RawAssignment = {
  user_id: string;
  duty_role: DutyRole;
  verified: boolean;
  profile: { full_name: string | null; photo_url: string | null } | null;
};

/** Event plus its assigned people, replacing Base44's embedded arrays. */
export async function getEvent(id: string): Promise<EventDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `*, assignments:event_assignments(
         user_id, duty_role, verified,
         profile:profiles!event_assignments_user_id_fkey(full_name, photo_url)
       )`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { assignments, ...event } = data as unknown as EventRow & { assignments: RawAssignment[] };
  const toPerson = (a: RawAssignment): EventPerson => ({
    user_id: a.user_id,
    name: a.profile?.full_name ?? null,
    photo_url: a.profile?.photo_url ?? null,
    verified: a.verified,
  });
  const byName = (a: EventPerson, b: EventPerson) => (a.name ?? "").localeCompare(b.name ?? "");

  return {
    ...event,
    team_leaders: (assignments ?? []).filter((a) => a.duty_role === "team_leader").map(toPerson).sort(byName),
    charters: (assignments ?? []).filter((a) => a.duty_role === "charter").map(toPerson).sort(byName),
  };
}

/** Every event a person was assigned to, newest first. */
export async function listDutyHistory(userId: string): Promise<DutyHistoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_assignments")
    .select("duty_role, event:events(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as { duty_role: DutyRole; event: EventRow | null }[])
    .filter((row): row is { duty_role: DutyRole; event: EventRow } => row.event !== null)
    .map((row) => ({ event: row.event, dutyRole: row.duty_role }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date))
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Charter: events assigned to the signed-in user
// ---------------------------------------------------------------------------

type RawMyEvent = EventRow & {
  event_assignments: { verified: boolean }[];
};

function toMyEvent(raw: RawMyEvent): MyEvent {
  const { event_assignments, ...event } = raw;
  return { ...event, verified: event_assignments[0]?.verified ?? false };
}

const MY_EVENT_SELECT = "*, event_assignments!inner(user_id, duty_role, verified)";

export interface ListMyEventsParams {
  userId: string;
  /** Which side of the duty: events you chart on (default) or events you lead. */
  dutyRole?: DutyRole;
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
  limit?: number;
}

/** Events where this user is assigned as a charter, oldest first. */
export async function listMyEvents({ userId, dutyRole = "charter", from, to, limit = 100 }: ListMyEventsParams): Promise<MyEvent[]> {
  const supabase = createClient();
  let q = supabase
    .from("events")
    .select(MY_EVENT_SELECT)
    .eq("event_assignments.user_id", userId)
    .eq("event_assignments.duty_role", dutyRole)
    .order("date", { ascending: true })
    .order("time", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawMyEvent[]).map(toMyEvent);
}

/**
 * Today's duty for this charter. If they somehow have two events today,
 * a verified one wins so the Home screen and the New Report gate agree.
 */
export async function getTodaysDuty(
  userId: string,
  today: string,
  dutyRole: DutyRole = "charter"
): Promise<MyEvent | null> {
  const events = await listMyEvents({ userId, dutyRole, from: today, to: today, limit: 5 });
  return events.find((e) => e.verified) ?? events[0] ?? null;
}

// ---------------------------------------------------------------------------
// Team Leader: approving charters
// ---------------------------------------------------------------------------

/**
 * Approve (true) or revoke (false) one charter for one event. The database
 * function checks that you lead the event and that it isn't already over.
 */
export async function setCharterVerified(eventId: string, userId: string, verified: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_charter_verified", {
    p_event: eventId,
    p_user: userId,
    p_verified: verified,
  });
  if (error) throw new Error(error.message);
}
