import type { DutyRole, PlatformRole } from "@/types/auth";

export type ReportStatus = "draft" | "submitted" | "reviewed";
export type Sex = "M" | "F";

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
