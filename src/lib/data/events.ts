import { createClient } from "@/lib/supabase";
import type { DutyHistoryItem, EventDetail, EventPerson, EventRow } from "@/types/domain";
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
