import { createClient } from "@/lib/supabase";
import type { VitalSign } from "@/types/domain";

export type { VitalSign };

export interface CreateVitalSignInput {
  id?: string;
  patient_report_id: string;
  temperature?: number | null;
  pulse_rate_per_minute?: number | null;
  respiration_rate_per_minute?: number | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  oxygen_level?: number | null;
  created_at?: string;
}

export async function listVitalSigns(patientReportId: string): Promise<VitalSign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vital_signs")
    .select("*")
    .eq("patient_report_id", patientReportId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VitalSign[];
}

export async function addVitalSign(input: CreateVitalSignInput): Promise<VitalSign> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vital_signs")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      patient_report_id: input.patient_report_id,
      temperature: input.temperature ?? null,
      pulse_rate_per_minute: input.pulse_rate_per_minute ?? null,
      respiration_rate_per_minute: input.respiration_rate_per_minute ?? null,
      blood_pressure_systolic: input.blood_pressure_systolic ?? null,
      blood_pressure_diastolic: input.blood_pressure_diastolic ?? null,
      oxygen_level: input.oxygen_level ?? null,
      ...(input.created_at ? { created_at: input.created_at } : {}),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as VitalSign;
}

export async function addVitalSigns(inputs: CreateVitalSignInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("vital_signs").insert(
    inputs.map((input) => ({
      id: input.id ?? crypto.randomUUID(),
      patient_report_id: input.patient_report_id,
      temperature: input.temperature ?? null,
      pulse_rate_per_minute: input.pulse_rate_per_minute ?? null,
      respiration_rate_per_minute: input.respiration_rate_per_minute ?? null,
      blood_pressure_systolic: input.blood_pressure_systolic ?? null,
      blood_pressure_diastolic: input.blood_pressure_diastolic ?? null,
      oxygen_level: input.oxygen_level ?? null,
      ...(input.created_at ? { created_at: input.created_at } : {}),
    }))
  );
  if (error) throw new Error(error.message);
}

export async function updateVitalSign(
  id: string,
  patch: Partial<Omit<VitalSign, "id" | "patient_report_id" | "created_at">>
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("vital_signs").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the vitals — you may not have permission.");
  }
}

export async function deleteVitalSign(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("vital_signs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
