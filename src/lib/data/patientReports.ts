import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type {
  EventRecord,
  Patient,
  PatientReport,
  PatientReportStatus,
  ReportNote,
  UserRecord,
  VitalSign,
} from "@/types/domain";

export type { PatientReport, PatientReportStatus };

type NamedUser = Pick<UserRecord, "id" | "first_name" | "last_name" | "pfp_img_url">;

export interface PatientReportWithRelations extends PatientReport {
  patient: (Patient & { event: EventRecord | null }) | null;
  reporter: NamedUser | null;
  vital_signs: VitalSign[];
  report_notes: (ReportNote & { remarker: NamedUser | null })[];
}

export interface CreatePatientReportInput {
  id?: string;
  patient_id: string;
  chief_complaint: string;
  care_given: string;
  signature_url?: string | null;
  status?: PatientReportStatus;
  reported_by?: string;
}

export interface ListPatientReportsParams {
  status?: PatientReportStatus;
  patientId?: string;
  eventId?: string;
  eventIds?: string[];
  reportedBy?: string;
  search?: string;
  limit?: number;
  ascending?: boolean;
}

// `inner` matters when filtering on the patient (event or name): with a normal
// join, Supabase only blanks the patient on non-matching rows and still returns
// the report, so every event's reports showed up (and were exported).
const reportSelect = (inner: boolean) => `
  *,
  patient:patients!patient_reports_patient_id_fkey${inner ? "!inner" : ""}(
    *,
    event:events!patients_event_id_fkey(*)
  ),
  reporter:users!patient_reports_reported_by_fkey(id, first_name, last_name, pfp_img_url),
  vital_signs(*),
  report_notes(*, remarker:users!report_notes_remarked_by_fkey(id, first_name, last_name, pfp_img_url))
`;
const REPORT_SELECT = reportSelect(false);

export async function listPatientReports(params: ListPatientReportsParams = {}): Promise<PatientReportWithRelations[]> {
  const {
    status,
    patientId,
    eventId,
    eventIds,
    reportedBy,
    search,
    limit = 100,
    ascending = false,
  } = params;
  if (eventIds && eventIds.length === 0) return [];

  const term = search ? sanitizeSearch(search) : "";
  const filtersOnPatient = !!eventId || !!eventIds || !!term;

  const supabase = createClient();
  let q = supabase
    .from("patient_reports")
    .select(reportSelect(filtersOnPatient))
    .order("created_at", { ascending })
    .limit(limit);

  if (status) q = q.eq("status", status);
  if (patientId) q = q.eq("patient_id", patientId);
  if (eventId) q = q.eq("patient.event_id", eventId);
  if (eventIds) q = q.in("patient.event_id", eventIds);
  if (reportedBy) q = q.eq("reported_by", reportedBy);
  if (term) q = q.ilike("patient.name", `%${term}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PatientReportWithRelations[];
}

export async function countPatientReports(params: {
  status?: PatientReportStatus;
  eventId?: string;
} = {}): Promise<number> {
  const { status, eventId } = params;
  const supabase = createClient();
  let q = supabase
    .from("patient_reports")
    .select("id, patient:patients!inner(event_id)", { count: "exact", head: true });
  if (status) q = q.eq("status", status);
  if (eventId) q = q.eq("patient.event_id", eventId);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getPatientReport(id: string): Promise<PatientReportWithRelations | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("patient_reports")
    .select(REPORT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as PatientReportWithRelations | null) ?? null;
}

export async function createPatientReport(input: CreatePatientReportInput): Promise<PatientReport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase
    .from("patient_reports")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      patient_id: input.patient_id,
      chief_complaint: input.chief_complaint.trim(),
      care_given: input.care_given.trim(),
      signature_url: input.signature_url ?? null,
      status: input.status ?? "Pending",
      reported_by: input.reported_by ?? user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PatientReport;
}

export async function updatePatientReport(
  id: string,
  patch: Partial<Pick<PatientReport, "chief_complaint" | "care_given" | "signature_url" | "status">>
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("patient_reports").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the report — you may not have permission.");
  }
}

export async function deletePatientReport(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("patient_reports").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete the report — it may already be gone, or you may not have permission.");
  }
}

export async function reviewPatientReport(id: string, notes: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("review_patient_report", {
    p_report_id: id,
    p_notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
