import { createClient } from "@/lib/supabase";
import type { Report, ReportStatus, Sex, VitalsReading } from "@/types/domain";
import {
  countPatientReports,
  createPatientReport,
  getPatientReport,
  listPatientReports,
  reviewPatientReport,
  type PatientReportWithRelations,
} from "@/lib/data/patientReports";
import { createPatient } from "@/lib/data/patients";
import { addVitalSigns } from "@/lib/data/vitalSigns";
import { addReportNote } from "@/lib/data/reportNotes";
import { createNotification } from "@/lib/data/notifications";
import { AGE_MAX, VITAL_RULES, checkVitalsRow, type VitalField } from "@/lib/vitals";

export type { Report, ReportStatus, VitalsReading };

function localDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nameOf(person: { first_name: string; last_name: string } | null | undefined): string | null {
  if (!person) return null;
  const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
  return name || null;
}

function mapStatus(status: PatientReportWithRelations["status"]): ReportStatus {
  return status === "Reviewed" ? "reviewed" : "submitted";
}

function mapVital(vital: PatientReportWithRelations["vital_signs"][number]): VitalsReading {
  return {
    id: vital.id,
    report_id: vital.patient_report_id,
    time_taken: vital.created_at,
    temp: vital.temperature,
    pr: vital.pulse_rate_per_minute,
    rr: vital.respiration_rate_per_minute,
    bp_systolic: vital.blood_pressure_systolic,
    bp_diastolic: vital.blood_pressure_diastolic,
    spo2: vital.oxygen_level,
  };
}

interface LeaderInfo {
  user_id: string;
  name: string | null;
}

async function teamLeadersByEvent(eventIds: string[]): Promise<Map<string, LeaderInfo>> {
  const map = new Map<string, LeaderInfo>();
  if (eventIds.length === 0) return map;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("event_id, user_id, user:users!event_members_user_id_fkey(first_name, last_name)")
    .in("event_id", eventIds)
    .in("member_role", ["TL", "Admin"]);
  if (error) return map;
  for (const row of (data ?? []) as unknown as {
    event_id: string;
    user_id: string;
    user: { first_name: string; last_name: string } | null;
  }[]) {
    if (!map.has(row.event_id)) {
      map.set(row.event_id, { user_id: row.user_id, name: nameOf(row.user) });
    }
  }
  return map;
}

function flatten(raw: PatientReportWithRelations, leaders: Map<string, LeaderInfo>): Report {
  const patient = raw.patient;
  const event = patient?.event ?? null;
  const notes = [...(raw.report_notes ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latestNote = notes.at(-1) ?? null;
  const leader = event ? leaders.get(event.id) : undefined;
  const reviewed = raw.status === "Reviewed";

  return {
    id: raw.id,
    event_id: event?.id ?? "",
    charter_id: raw.reported_by,
    team_leader_id: leader?.user_id ?? null,
    patient_id: raw.patient_id,
    student_id: patient?.student_id ?? null,
    chief_complaint: raw.chief_complaint,
    patient_name: patient?.name ?? "",
    age: patient?.age ?? null,
    sex: (patient?.sex as Sex | undefined) ?? null,
    address: patient?.address ?? null,
    care_given: raw.care_given,
    signature_url: raw.signature_url,
    status: mapStatus(raw.status),
    review_notes: latestNote?.content ?? null,
    admin_notes: null,
    reviewed_by: reviewed ? latestNote?.remarked_by ?? null : null,
    submitted_at: raw.created_at,
    reviewed_at: reviewed ? latestNote?.created_at ?? raw.updated_at : null,
    synced_at: null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    event_title: event?.name ?? null,
    event_date: event ? localDate(event.event_date) : null,
    event_location: event?.location ?? null,
    charter_name: nameOf(raw.reporter),
    team_leader_name: leader?.name ?? null,
    reviewed_by_name: reviewed ? nameOf(latestNote?.remarker) : null,
    vitals_readings: (raw.vital_signs ?? []).map(mapVital).sort((a, b) => a.time_taken.localeCompare(b.time_taken)),
  };
}

/** Count of reports the caller can see. */
export async function countReports(status?: ReportStatus, eventId?: string): Promise<number> {
  if (status === "draft") return 0;
  return countPatientReports({
    status: status === "reviewed" ? "Reviewed" : status === "submitted" ? "Pending" : undefined,
    eventId,
  });
}

export interface ListReportsParams {
  status?: ReportStatus;
  eventId?: string;
  eventIds?: string[];
  charterId?: string;
  search?: string;
  limit?: number;
  includeDrafts?: boolean;
}

export async function listReports(params: ListReportsParams = {}): Promise<Report[]> {
  const { status, eventId, eventIds, charterId, search, limit = 100 } = params;
  if (eventIds && eventIds.length === 0) return [];
  if (status === "draft") return [];

  const rows = await listPatientReports({
    eventId,
    eventIds,
    reportedBy: charterId,
    search,
    limit,
    status: status === "reviewed" ? "Reviewed" : status === "submitted" ? "Pending" : undefined,
  });
  const leaders = await teamLeadersByEvent([
    ...new Set(rows.map((row) => row.patient?.event?.id).filter((id): id is string => Boolean(id))),
  ]);
  return rows.map((row) => flatten(row, leaders));
}

export async function getReport(id: string): Promise<Report | null> {
  const raw = await getPatientReport(id);
  if (!raw) return null;
  const eventId = raw.patient?.event?.id;
  const leaders = await teamLeadersByEvent(eventId ? [eventId] : []);
  return flatten(raw, leaders);
}

export async function listReportsForExport(eventId: string): Promise<Report[]> {
  const rows = await listPatientReports({ eventId, limit: 1000, ascending: true });
  const leaders = await teamLeadersByEvent([eventId]);
  return rows.map((row) => flatten(row, leaders));
}

export async function saveAdminNotes(id: string, notes: string): Promise<void> {
  const trimmed = notes.trim();
  if (!trimmed) return;
  await addReportNote(id, trimmed);
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
  patient_sex: Sex;
  patient_address: string;
  vitals: VitalFormRow[];
  care_given: string;
  signaturePath: string;
}

function parseNumber(value: string, label: string, opts: { int?: boolean } = {}): number | null {
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n))) {
    throw new Error(`${label} must be a ${opts.int ? "whole " : ""}number (you entered "${value}").`);
  }
  return n;
}

async function notifyTeamLeader(input: SubmitReportInput): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", input.eventId)
    .in("member_role", ["TL", "Admin"])
    .limit(1);
  if (error || !data || data.length === 0) return;
  try {
    await createNotification({
      receiver_id: (data[0] as { user_id: string }).user_id,
      type: "Report Pending",
      event_id: input.eventId,
      patient_report_id: input.id,
    });
  } catch {
    // A missing notification must never lose the patient report.
  }
}

export async function submitReport(input: SubmitReportInput): Promise<string> {
  const age = parseNumber(input.patient_age, "Age", { int: true });
  if (age === null) throw new Error("Age is required.");
  if (age < 0 || age > AGE_MAX) throw new Error(`Age must be 0–${AGE_MAX}.`);

  const vitals = input.vitals.map((v, i) => {
    const where = `Vitals check ${i + 1}`;
    // Same checks the form shows, in case anything slips past the screen.
    const problem = Object.entries(checkVitalsRow(v)).find(([, check]) => check?.error);
    if (problem) {
      const [field, check] = problem;
      throw new Error(`${where} ${VITAL_RULES[field as VitalField].label.toLowerCase()}: ${check?.error}`);
    }
    const taken = new Date(`${input.eventDate}T${v.time}`);
    if (Number.isNaN(taken.getTime())) throw new Error(`${where}: the time isn't valid.`);
    return {
      patient_report_id: input.id,
      created_at: taken.toISOString(),
      temperature: parseNumber(v.temp, `${where} temperature`),
      pulse_rate_per_minute: parseNumber(v.pr, `${where} pulse rate`, { int: true }),
      respiration_rate_per_minute: parseNumber(v.rr, `${where} respiratory rate`, { int: true }),
      blood_pressure_systolic: parseNumber(v.bp_sys, `${where} systolic BP`, { int: true }),
      blood_pressure_diastolic: parseNumber(v.bp_dia, `${where} diastolic BP`, { int: true }),
      oxygen_level: parseNumber(v.spo2, `${where} SpO₂`, { int: true }),
    };
  });

  const patient = await createPatient({
    name: input.patient_name,
    student_id: null,
    age,
    sex: input.patient_sex,
    event_id: input.eventId,
    address: input.patient_address,
  });

  await createPatientReport({
    id: input.id,
    patient_id: patient.id,
    chief_complaint: input.chief_complaint,
    care_given: input.care_given,
    signature_url: input.signaturePath,
    status: "Pending",
  });

  await addVitalSigns(vitals);
  await notifyTeamLeader(input);
  return input.id;
}

// ---------------------------------------------------------------------------
// Team Leader: reviewing a report
// ---------------------------------------------------------------------------

export async function reviewReport(id: string, notes: string): Promise<void> {
  await reviewPatientReport(id, notes);
}
