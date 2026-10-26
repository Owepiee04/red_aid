import { describeDbError, getDB } from "./db";
import type { OfflineVitalSign } from "./types";

export interface CreateVitalSignInput {
  vitalId?: string;
  patientReportId: string;
  temperature: number | null;
  pulseRatePerMinute: number | null;
  respirationRatePerMinute: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  oxygenLevel: number | null;
  recordedAt?: string;
}

export type UpdateVitalSignInput = Partial<Omit<OfflineVitalSign, "vitalId">>;

export async function create(input: CreateVitalSignInput): Promise<OfflineVitalSign> {
  const vital: OfflineVitalSign = {
    vitalId: input.vitalId ?? crypto.randomUUID(),
    patientReportId: input.patientReportId,
    temperature: input.temperature,
    pulseRatePerMinute: input.pulseRatePerMinute,
    respirationRatePerMinute: input.respirationRatePerMinute,
    bloodPressureSystolic: input.bloodPressureSystolic,
    bloodPressureDiastolic: input.bloodPressureDiastolic,
    oxygenLevel: input.oxygenLevel,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };

  try {
    const db = await getDB();
    await db.put("VitalSign", vital);
    return vital;
  } catch (error) {
    throw describeDbError("save the vital signs offline", error);
  }
}

export async function getById(vitalId: string): Promise<OfflineVitalSign | null> {
  try {
    const db = await getDB();
    return (await db.get("VitalSign", vitalId)) ?? null;
  } catch (error) {
    throw describeDbError("load the vital signs", error);
  }
}

export async function getAll(): Promise<OfflineVitalSign[]> {
  try {
    const db = await getDB();
    const vitals = await db.getAll("VitalSign");
    return vitals.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load vital signs", error);
  }
}

export async function getByReport(patientReportId: string): Promise<OfflineVitalSign[]> {
  try {
    const db = await getDB();
    const vitals = await db.getAllFromIndex("VitalSign", "patientReportId", patientReportId);
    return vitals.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  } catch (error) {
    throw describeDbError("load vital signs for the report", error);
  }
}

export async function update(vitalId: string, patch: UpdateVitalSignInput): Promise<OfflineVitalSign> {
  try {
    const db = await getDB();
    const existing = await db.get("VitalSign", vitalId);
    if (!existing) throw new Error(`Vital signs "${vitalId}" were not found.`);

    const updated: OfflineVitalSign = { ...existing, ...patch, vitalId: existing.vitalId };
    await db.put("VitalSign", updated);
    return updated;
  } catch (error) {
    throw describeDbError("update the vital signs", error);
  }
}

export async function remove(vitalId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("VitalSign", vitalId);
  } catch (error) {
    throw describeDbError("delete the vital signs", error);
  }
}

export { remove as delete };
