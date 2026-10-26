import { createClient } from "@/lib/supabase";
import { uploadSignatureBlob } from "@/lib/storage";
import * as PatientReportStore from "./PatientReport";
import * as PatientStore from "./Patient";
import * as VitalSignStore from "./VitalSign";
import type { OfflinePatient, OfflinePatientReport, OfflineVitalSign } from "./types";

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function insertPatient(patient: OfflinePatient): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("patients").upsert(
    {
      id: patient.patientId,
      name: patient.patientName,
      student_id: patient.studentId,
      age: patient.age,
      sex: patient.sex,
      event_id: patient.eventId,
      address: patient.address,
      added_by: patient.addedBy,
      created_at: patient.recordedAt,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`Couldn't sync the patient: ${error.message}`);
}

async function insertReport(report: OfflinePatientReport, signaturePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("patient_reports").upsert(
    {
      id: report.patientReportId,
      patient_id: report.patientId,
      chief_complaint: report.chiefComplaint,
      care_given: report.careGiven,
      signature_url: signaturePath,
      status: report.reportStatus,
      reported_by: report.reportedBy,
      created_at: report.recordedAt,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`Couldn't sync the report: ${error.message}`);
}

async function insertVitals(vitals: OfflineVitalSign[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("vital_signs").upsert(
    vitals.map((vital) => ({
      id: vital.vitalId,
      patient_report_id: vital.patientReportId,
      temperature: vital.temperature,
      pulse_rate_per_minute: vital.pulseRatePerMinute,
      respiration_rate_per_minute: vital.respirationRatePerMinute,
      blood_pressure_systolic: vital.bloodPressureSystolic,
      blood_pressure_diastolic: vital.bloodPressureDiastolic,
      oxygen_level: vital.oxygenLevel,
      created_at: vital.recordedAt,
    })),
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw new Error(`Couldn't sync the vital signs: ${error.message}`);
}

async function notifyReportSubmitted(reportId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("notify_report_submitted", { p_report_id: reportId });
  if (error) return;
}

async function syncPatientTree(patient: OfflinePatient): Promise<void> {
  const reports = await PatientReportStore.getByPatient(patient.patientId);

  await insertPatient(patient);

  for (const report of reports) {
    const signaturePath = await uploadSignatureBlob(
      report.reportedBy,
      report.patientReportId,
      report.signatureBlob
    );
    await insertReport(report, signaturePath);

    const vitals = await VitalSignStore.getByReport(report.patientReportId);
    if (vitals.length > 0) await insertVitals(vitals);

    await notifyReportSubmitted(report.patientReportId);
  }

  await PatientStore.remove(patient.patientId);
}

async function runSync(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  let patients: OfflinePatient[];
  try {
    patients = await PatientStore.getAll();
  } catch (error) {
    result.errors.push(errorText(error));
    return result;
  }

  for (const patient of patients) {
    try {
      await syncPatientTree(patient);
      result.synced += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${patient.patientName || patient.patientId}: ${errorText(error)}`);
    }
  }

  return result;
}

let activeSync: Promise<SyncResult> | null = null;

export function sync(): Promise<SyncResult> {
  if (activeSync) return activeSync;
  const run = runSync().finally(() => {
    activeSync = null;
  });
  activeSync = run;
  return run;
}

export async function hasUnsyncedData(): Promise<boolean> {
  try {
    return (await PatientStore.getAll()).length > 0;
  } catch {
    return false;
  }
}
