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

export async function logPatientAudit(input: {
  event_id: string;
  action_performed: AuditAction;
  affected_resource_id: string;
  log_description: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("log_patient_audit", {
    p_event_id: input.event_id,
    p_action: input.action_performed,
    p_affected_resource_id: input.affected_resource_id,
    p_description: input.log_description,
  });
  if (error) throw new Error(error.message);
}

export async function logEventAudit(input: {
  event_id: string;
  action_performed: EventAuditAction;
  affected_resource_identifier: string;
  log_description: string;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("log_event_audit", {
    p_event_id: input.event_id,
    p_action: input.action_performed,
    p_affected_resource_identifier: input.affected_resource_identifier,
    p_description: input.log_description,
  });
  if (error) throw new Error(error.message);
}
