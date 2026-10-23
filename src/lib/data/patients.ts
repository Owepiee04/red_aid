import { createClient } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/data/search";
import type { Patient, PatientSex } from "@/types/domain";

export type { Patient };

export interface CreatePatientInput {
  id?: string;
  name: string;
  student_id?: string | null;
  age: number;
  sex: PatientSex;
  event_id: string;
  address: string;
  added_by?: string;
}

export interface ListPatientsParams {
  eventId: string;
  search?: string;
  limit?: number;
}

export async function listPatients({ eventId, search, limit = 500 }: ListPatientsParams): Promise<Patient[]> {
  const supabase = createClient();
  let q = supabase
    .from("patients")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(limit);
  const term = search ? sanitizeSearch(search) : "";
  if (term) q = q.ilike("name", `%${term}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Patient[];
}

export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Patient | null) ?? null;
}

export async function countPatients(eventId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase
    .from("patients")
    .insert({
      id: input.id ?? crypto.randomUUID(),
      name: input.name.trim(),
      student_id: input.student_id?.trim() || null,
      age: input.age,
      sex: input.sex,
      event_id: input.event_id,
      address: input.address.trim(),
      added_by: input.added_by ?? user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Patient;
}

export async function updatePatient(
  id: string,
  patch: Partial<Pick<Patient, "name" | "student_id" | "age" | "sex" | "address">>
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("patients").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the patient — you may not have permission.");
  }
}

export async function deletePatient(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("patients").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete the patient — it may already be gone, or you may not have permission.");
  }
}
