import { createClient } from "@/lib/supabase";
import type { ReportNote } from "@/types/domain";

export type { ReportNote };

export async function listReportNotes(patientReportId: string): Promise<ReportNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("report_notes")
    .select("*")
    .eq("patient_report_id", patientReportId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportNote[];
}

export async function addReportNote(patientReportId: string, content: string): Promise<ReportNote> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase
    .from("report_notes")
    .insert({
      id: crypto.randomUUID(),
      patient_report_id: patientReportId,
      remarked_by: user.id,
      content: content.trim(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ReportNote;
}

export async function deleteReportNote(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from("report_notes").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete the note — it may already be gone, or you may not have permission.");
  }
}
