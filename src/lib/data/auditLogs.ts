import { createClient } from "@/lib/supabase";
import type { AuditAction, EventAuditAction, EventAuditLog, PatientAuditLog } from "@/types/domain";

export type { AuditAction, EventAuditAction, EventAuditLog, PatientAuditLog };

export async function listPatientAuditLogs(eventId: string, limit = 500): Promise<PatientAuditLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_logs_patient")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PatientAuditLog[];
}

export async function listEventAuditLogs(eventId: string, limit = 500): Promise<EventAuditLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_logs_event")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EventAuditLog[];
}


