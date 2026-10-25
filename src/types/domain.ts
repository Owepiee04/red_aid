import type { DutyRole, PlatformRole } from "@/types/auth";

export type ReportStatus = "draft" | "submitted" | "reviewed";
export type Sex = "M" | "F" | "Others";

export type MemberRole = "TL" | "Admin" | "First Aider" | "Charter";
export type PatientSex = "M" | "F" | "Others";
export type PatientReportStatus = "Pending" | "Reviewed";
export type NotificationType = "Report Pending" | "Verified" | "Note";
export type AuditAction = "CREATE" | "READ" | "UPDATE" | "DELETE";
export type EventAuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface UserRecord {
  id: string;
  first_name: string;
  last_name: string;
  pfp_img_url: string | null;
  is_admin: boolean;
  duty_role: DutyRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRecord {
  id: string;
  name: string;
  location: string;
  event_date: string;
  description: string | null;
  is_deleted: boolean;
  is_exported: boolean;
  /** When a Team Leader/Admin pressed End Duty (null while the duty is open). */
  ended_at: string | null;
  ended_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventMemberRow {
  user_id: string;
  event_id: string;
  member_role: MemberRole;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  student_id: string | null;
  age: number;
  sex: PatientSex;
  event_id: string;
  address: string;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export interface PatientReport {
  id: string;
  patient_id: string;
  chief_complaint: string;
  care_given: string;
  signature_url: string | null;
  status: PatientReportStatus;
  reported_by: string;
  created_at: string;
  updated_at: string;
}

export interface VitalSign {
  id: string;
  patient_report_id: string;
  temperature: number | null;
  pulse_rate_per_minute: number | null;
  respiration_rate_per_minute: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  oxygen_level: number | null;
  created_at: string;
}

export interface ReportNote {
  id: string;
  patient_report_id: string;
  remarked_by: string;
  content: string;
  created_at: string;
}

export interface PatientAuditLog {
  id: string;
  event_id: string;
  action_performed: AuditAction;
  action_performer: string;
  affected_resource_id: string;
  log_description: string;
  created_at: string;
}

export interface EventAuditLog {
  id: string;
  event_id: string;
  action_performed: EventAuditAction;
  action_performer: string;
  affected_resource_identifier: string;
  log_description: string;
  created_at: string;
}

export interface Notification {
  id: string;
  receiver_id: string;
  sender_id: string;
  type: NotificationType;
  event_id: string | null;
  vital_signs_id: string | null;
  note_id: string | null;
  patient_report_id: string | null;
  has_been_read: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: PlatformRole;
  duty_role: DutyRole | null;
  active: boolean;
  photo_url: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS
  location: string | null;
  description: string | null;
  created_by: string | null;
  /** When a Team Leader/Admin ended the duty. null = still open. */
  ended_at: string | null;
  ended_by: string | null;
  created_at: string;
  updated_at: string;
  /** Row name in the new events table. */
  name?: string;
  is_deleted?: boolean;
  is_exported?: boolean;
}

/** One person on duty for an event, with their profile joined in. */
export interface EventPerson {
  user_id: string;
  name: string | null;
  photo_url: string | null;
  verified: boolean;
}

export interface EventDetail extends EventRow {
  team_leaders: EventPerson[];
  charters: EventPerson[];
}

/** An event the signed-in charter is assigned to, with their own verification state. */
export interface MyEvent extends EventRow {
  verified: boolean;
}

export interface DutyHistoryItem {
  event: EventRow;
  dutyRole: DutyRole;
}

export interface VitalsReading {
  id: string;
  report_id: string;
  time_taken: string;
  temp: number | null;
  pr: number | null;
  rr: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  spo2: number | null;
}

export interface Report {
  id: string;
  event_id: string;
  charter_id: string;
  team_leader_id: string | null;
  patient_id?: string;
  student_id?: string | null;
  chief_complaint: string;
  patient_name: string;
  age: number | null;
  sex: Sex | null;
  address: string | null;
  care_given: string | null;
  signature_url: string | null;
  status: ReportStatus;
  review_notes: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;

  // Flattened from joins so list/detail components don't need to know about them.
  event_title: string | null;
  event_date: string | null;
  event_location: string | null;
  charter_name: string | null;
  team_leader_name: string | null;
  reviewed_by_name: string | null;
  vitals_readings: VitalsReading[];
}
