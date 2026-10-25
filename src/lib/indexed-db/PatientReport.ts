import { describeDbError, getDB } from "./db";
import type { OfflinePatientReport } from "./types";

export interface CreatePatientReportInput {
  patientReportId?: string;
  patientId: string;
  chiefComplaint: string;
  careGiven: string;
  signatureBlob: Blob;
  reportedBy: string;
  recordedAt?: string;
}

export type UpdatePatientReportInput = Partial<Omit<OfflinePatientReport, "patientReportId">>;

export async function create(input: CreatePatientReportInput): Promise<OfflinePatientReport> {
  const report: OfflinePatientReport = {
    patientReportId: input.patientReportId ?? crypto.randomUUID(),
    patientId: input.patientId,
    chiefComplaint: input.chiefComplaint,
    careGiven: input.careGiven,
    signatureBlob: input.signatureBlob,
    reportStatus: "Pending",
    reportedBy: input.reportedBy,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };

  try {
    const db = await getDB();
    await db.put("PatientReport", report);
    return report;
  } catch (error) {
    throw describeDbError("save the report offline", error);
  }
}

export async function getById(patientReportId: string): Promise<OfflinePatientReport | null> {
  try {
    const db = await getDB();
    return (await db.get("PatientReport", patientReportId)) ?? null;
  } catch (error) {
    throw describeDbError("load the report", error);
  }
}

export async function getAll(): Promise<OfflinePatientReport[]> {
  try {
    const db = await getDB();
    const reports = await db.getAll("PatientReport");
    return reports.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load reports", error);
  }
}

export async function getByPatient(patientId: string): Promise<OfflinePatientReport[]> {
  try {
    const db = await getDB();
    const reports = await db.getAllFromIndex("PatientReport", "patientId", patientId);
    return reports.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load reports for the patient", error);
  }
}

export async function getByReporter(reportedBy: string): Promise<OfflinePatientReport[]> {
  try {
    const db = await getDB();
    const reports = await db.getAllFromIndex("PatientReport", "reportedBy", reportedBy);
    return reports.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load reports submitted by this user", error);
  }
}

export async function update(
  patientReportId: string,
  patch: UpdatePatientReportInput
): Promise<OfflinePatientReport> {
  try {
    const db = await getDB();
    const existing = await db.get("PatientReport", patientReportId);
    if (!existing) throw new Error(`Report "${patientReportId}" was not found.`);

    const updated: OfflinePatientReport = {
      ...existing,
      ...patch,
      patientReportId: existing.patientReportId,
    };
    await db.put("PatientReport", updated);
    return updated;
  } catch (error) {
    throw describeDbError("update the report", error);
  }
}

export async function remove(patientReportId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["PatientReport", "VitalSign"], "readwrite");
    const vitals = await tx
      .objectStore("VitalSign")
      .index("patientReportId")
      .getAll(patientReportId);

    for (const vital of vitals) {
      await tx.objectStore("VitalSign").delete(vital.vitalId);
    }

    await tx.objectStore("PatientReport").delete(patientReportId);
    await tx.done;
  } catch (error) {
    throw describeDbError("delete the report and its vitals", error);
  }
}

export { remove as delete };
