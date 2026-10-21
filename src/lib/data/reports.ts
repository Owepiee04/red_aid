import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type { Report, ReportStatus, VitalsReading } from "@/types/domain";

// FK hints (!reports_charter_id_fkey ...) are required because reports has
// several foreign keys to profiles — without them PostgREST can't tell which
// one we mean.
const REPORT_SELECT = `
  *,
  event:events(title),
  charter:profiles!reports_charter_id_fkey(full_name),
  team_leader:profiles!reports_team_leader_id_fkey(full_name),
  reviewer:profiles!reports_reviewed_by_fkey(full_name)
`;

type Named = { full_name: string | null } | null;
type RawReport = Omit<
  Report,
  "event_title" | "charter_name" | "team_leader_name" | "reviewed_by_name" | "vitals_readings"
> & {
  event: { title: string } | null;
  charter: Named;
  team_leader: Named;
  reviewer: Named;
  vitals_readings?: VitalsReading[];
};

function flatten(raw: RawReport): Report {
  const { event, charter, team_leader, reviewer, vitals_readings, ...rest } = raw;
  return {
    ...rest,
    event_title: event?.title ?? null,
    charter_name: charter?.full_name ?? null,
    team_leader_name: team_leader?.full_name ?? null,
    reviewed_by_name: reviewer?.full_name ?? null,
    vitals_readings: [...(vitals_readings ?? [])].sort((a, b) =>
      a.time_taken.localeCompare(b.time_taken)
    ),
  };
}

/** Count of reports the admin can see (drafts are hidden by RLS). */
export async function countReports(status?: ReportStatus): Promise<number> {
  const supabase = createClient();
  let q = supabase.from("reports").select("id", { count: "exact", head: true });
  if (status) q = q.eq("status", status);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ListReportsParams {
  status?: Exclude<ReportStatus, "draft">;
  eventId?: string;
  charterId?: string;
  search?: string;
  limit?: number;
}

export async function listReports(params: ListReportsParams = {}): Promise<Report[]> {
  const { status, eventId, charterId, search, limit = 100 } = params;
  const supabase = createClient();
  let q = supabase
    .from("reports")
    .select(REPORT_SELECT)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  if (eventId) q = q.eq("event_id", eventId);
  if (charterId) q = q.eq("charter_id", charterId);
  const term = search ? sanitizeSearch(search) : "";
  if (term) q = q.ilike("patient_name", `%${term}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawReport[]).map(flatten);
}

/** Returns null when the report doesn't exist (or RLS hides it, e.g. a draft). */
export async function getReport(id: string): Promise<Report | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(`${REPORT_SELECT}, vitals_readings(*)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? flatten(data as unknown as RawReport) : null;
}

export async function saveAdminNotes(id: string, notes: string): Promise<void> {
  const supabase = createClient();
  // .select() so a policy that silently blocks the update shows up as 0 rows
  // instead of a fake "saved" toast.
  const { data, error } = await supabase
    .from("reports")
    .update({ admin_notes: notes.trim() })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't save — you may not have permission to edit this report.");
  }
}
