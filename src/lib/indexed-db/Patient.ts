import { describeDbError, getDB } from "./db";
import type { OfflinePatient, Sex } from "./types";

export interface CreatePatientInput {
  patientId?: string;
  patientName: string;
  studentId: string | null;
  age: number;
  sex: Sex;
  eventId: string;
  address: string;
  addedBy: string;
  recordedAt?: string;
}

export type UpdatePatientInput = Partial<Omit<OfflinePatient, "patientId">>;

export async function create(input: CreatePatientInput): Promise<OfflinePatient> {
  const patient: OfflinePatient = {
    patientId: input.patientId ?? crypto.randomUUID(),
    patientName: input.patientName,
    studentId: input.studentId,
    age: input.age,
    sex: input.sex,
    eventId: input.eventId,
    address: input.address,
    addedBy: input.addedBy,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };

  try {
    const db = await getDB();
    await db.put("Patient", patient);
    return patient;
  } catch (error) {
    throw describeDbError("save the patient offline", error);
  }
}

export async function getById(patientId: string): Promise<OfflinePatient | null> {
  try {
    const db = await getDB();
    return (await db.get("Patient", patientId)) ?? null;
  } catch (error) {
    throw describeDbError("load the patient", error);
  }
}

export async function getAll(): Promise<OfflinePatient[]> {
  try {
    const db = await getDB();
    const patients = await db.getAll("Patient");
    return patients.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load patients", error);
  }
}

export async function getByEvent(eventId: string): Promise<OfflinePatient[]> {
  try {
    const db = await getDB();
    const patients = await db.getAllFromIndex("Patient", "eventId", eventId);
    return patients.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load patients for the event", error);
  }
}

export async function getByAddedBy(addedBy: string): Promise<OfflinePatient[]> {
  try {
    const db = await getDB();
    const patients = await db.getAllFromIndex("Patient", "addedBy", addedBy);
    return patients.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load patients added by this user", error);
  }
}

export async function update(patientId: string, patch: UpdatePatientInput): Promise<OfflinePatient> {
  try {
    const db = await getDB();
    const existing = await db.get("Patient", patientId);
    if (!existing) throw new Error(`Patient "${patientId}" was not found.`);

    const updated: OfflinePatient = { ...existing, ...patch, patientId: existing.patientId };
    await db.put("Patient", updated);
    return updated;
  } catch (error) {
    throw describeDbError("update the patient", error);
  }
}

export async function remove(patientId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["Patient", "PatientReport", "VitalSign"], "readwrite");
    const reports = await tx.objectStore("PatientReport").index("patientId").getAll(patientId);

    for (const report of reports) {
      const vitals = await tx
        .objectStore("VitalSign")
        .index("patientReportId")
        .getAll(report.patientReportId);
      for (const vital of vitals) {
        await tx.objectStore("VitalSign").delete(vital.vitalId);
      }
      await tx.objectStore("PatientReport").delete(report.patientReportId);
    }

    await tx.objectStore("Patient").delete(patientId);
    await tx.done;
  } catch (error) {
    throw describeDbError("delete the patient and its reports", error);
  }
}

export { remove as delete };
