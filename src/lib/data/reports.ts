import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type { Report, ReportStatus, VitalsReading } from "@/types/domain";

// FK hints (!reports_charter_id_fkey ...) are required because reports has
// several foreign keys to profiles — without them PostgREST can't tell which
// one we mean.
const REPORT_SELECT = `
  *,
  event:events(title, date, location),
  charter:profiles!reports_charter_id_fkey(full_name),
  team_leader:profiles!reports_team_leader_id_fkey(full_name),
  reviewer:profiles!reports_reviewed_by_fkey(full_name)
`;

type Named = { full_name: string | null } | null;
type RawReport = Omit<
  Report,
  "event_title" | "event_date" | "event_location" | "charter_name" | "team_leader_name" | "reviewed_by_name" | "vitals_readings"
> & {
  event: { title: string; date: string; location: string | null } | null;
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
    event_date: event?.date ?? null,
    event_location: event?.location ?? null,
    charter_name: charter?.full_name ?? null,
    team_leader_name: team_leader?.full_name ?? null,
    reviewed_by_name: reviewer?.full_name ?? null,
    vitals_readings: [...(vitals_readings ?? [])].sort((a, b) =>
      a.time_taken.localeCompare(b.time_taken)
    ),
  };
}

/** Count of reports the admin can see (drafts are hidden by RLS). */
export async function countReports(status?: ReportStatus, eventId?: string): Promise<number> {
  const supabase = createClient();
  let q = supabase.from("reports").select("id", { count: "exact", head: true });
  if (status) q = q.eq("status", status);
  if (eventId) q = q.eq("event_id", eventId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ListReportsParams {
  status?: ReportStatus;
  eventId?: string;
  /** Only reports from these events (e.g. the duties a Team Leader leads). */
  eventIds?: string[];
  charterId?: string;
  search?: string;
  limit?: number;
  /** Drafts are only visible to their own charter (RLS); admins never see them. */
  includeDrafts?: boolean;
}

export async function listReports(params: ListReportsParams = {}): Promise<Report[]> {
  const { status, eventId, eventIds, charterId, search, limit = 100, includeDrafts = false } = params;
  if (eventIds && eventIds.length === 0) return []; // .in() with an empty list is an error
  const supabase = createClient();
  let q = supabase
    .from("reports")
    .select(REPORT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!includeDrafts) q = q.neq("status", "draft");
  if (status) q = q.eq("status", status);
  if (eventId) q = q.eq("event_id", eventId);
  if (eventIds) q = q.in("event_id", eventIds);
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

/**
 * Every submitted / reviewed report of one event, with its vitals, for the Excel
 * export. Drafts are left out (admins can't see them anyway). Oldest first, so the
 * spreadsheet reads in the order patients were seen.
 * Supabase returns at most 1000 rows per request by default; an event with more
 * reports than that would need paging.
 */
export async function listReportsForExport(eventId: string): Promise<Report[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(`${REPORT_SELECT}, vitals_readings(*)`)
    .eq("event_id", eventId)
    .neq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawReport[]).map(flatten);
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

// ---------------------------------------------------------------------------
// Charter: submitting a report
// ---------------------------------------------------------------------------

/** One row of the vitals form. Everything is a string because it comes from inputs. */
export interface VitalFormRow {
  time: string; // "HH:MM"
  temp: string;
  pr: string;
  rr: string;
  bp_sys: string;
  bp_dia: string;
  spo2: string;
}

export interface SubmitReportInput {
  id: string; // generated once per form, so a retry can't create a duplicate
  eventId: string;
  eventDate: string; // YYYY-MM-DD, used to turn "HH:MM" into a full timestamp
  chief_complaint: string;
  patient_name: string;
  patient_age: string;
  patient_sex: "M" | "F";
  patient_address: string;
  vitals: VitalFormRow[];
  care_given: string;
  signaturePath: string;
}

/**
 * Empty -> null. Otherwise it must be a real number (a decimal comma is accepted,
 * "36,5" -> 36.5) or we stop and say which field, instead of quietly saving blank
 * patient data.
 */
function parseNumber(value: string, label: string, opts: { int?: boolean } = {}): number | null {
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n))) {
    throw new Error(`${label} must be a ${opts.int ? "whole " : ""}number (you entered "${value}").`);
  }
  return n;
}

/**
 * Saves the report and its vitals in one transaction via the submit_report()
 * database function. The database refuses it unless this charter is verified
 * for an event happening today.
 */
export async function submitReport(input: SubmitReportInput): Promise<string> {
  const supabase = createClient();

  // Team Leader on duty for this event (first one if there are several).
  const { data: leaders, error: leaderError } = await supabase
    .from("event_assignments")
    .select("user_id")
    .eq("event_id", input.eventId)
    .eq("duty_role", "team_leader")
    .limit(1);
  if (leaderError) throw new Error(leaderError.message);

  const age = parseNumber(input.patient_age, "Age", { int: true });

  const vitals = input.vitals.map((v, i) => {
    const where = `Vitals check ${i + 1}`;
    const taken = new Date(`${input.eventDate}T${v.time}`);
    if (Number.isNaN(taken.getTime())) throw new Error(`${where}: the time isn't valid.`);
    return {
      // "14:30" on the event's date, in the browser's local time zone -> UTC timestamp
      time_taken: taken.toISOString(),
      temp: parseNumber(v.temp, `${where} temperature`),
      pr: parseNumber(v.pr, `${where} pulse rate`, { int: true }),
      rr: parseNumber(v.rr, `${where} respiratory rate`, { int: true }),
      bp_systolic: parseNumber(v.bp_sys, `${where} systolic BP`, { int: true }),
      bp_diastolic: parseNumber(v.bp_dia, `${where} diastolic BP`, { int: true }),
      spo2: parseNumber(v.spo2, `${where} SpO₂`, { int: true }),
    };
  });

  const { data, error } = await supabase.rpc("submit_report", {
    p_report: {
      id: input.id,
      event_id: input.eventId,
      team_leader_id: leaders?.[0]?.user_id ?? null,
      chief_complaint: input.chief_complaint.trim(),
      patient_name: input.patient_name.trim(),
      age,
      sex: input.patient_sex,
      address: input.patient_address.trim(),
      care_given: input.care_given.trim(),
      signature_url: input.signaturePath,
    },
    p_vitals: vitals,
  });
  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      throw new Error(
        "Charting isn't open for you on this duty. You need Team Leader approval, and the duty must not have been ended."
      );
    }
    throw new Error(error.message);
  }
  return data as string;
}

// ---------------------------------------------------------------------------
// Team Leader: reviewing a report
// ---------------------------------------------------------------------------

/**
 * Marks a submitted report as reviewed. The database function checks that you
 * lead this report's event and records who reviewed it and when.
 */
export async function reviewReport(id: string, notes: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("review_report", { p_report: id, p_notes: notes });
  if (error) throw new Error(error.message);
}
