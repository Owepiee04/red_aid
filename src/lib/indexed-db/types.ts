import type { DutyRole, PlatformRole } from "@/types/auth";

export type Sex = "M" | "F" | "Others";

export interface CachedUserProfile {
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformRole;
  dutyRole: DutyRole | null;
  active: boolean;
  photoPath: string | null;
  photoBlob: Blob | null;
  cachedAt: string;
}

export interface OfflinePatient {
  patientId: string;
  patientName: string;
  studentId: string | null;
  age: number;
  sex: Sex;
  eventId: string;
  address: string;
  addedBy: string;
  recordedAt: string;
}

export interface OfflinePatientReport {
  patientReportId: string;
  patientId: string;
  chiefComplaint: string;
  careGiven: string;
  signatureBlob: Blob;
  reportStatus: "Pending";
  reportedBy: string;
  recordedAt: string;
}

export interface OfflineVitalSign {
  vitalId: string;
  patientReportId: string;
  temperature: number | null;
  pulseRatePerMinute: number | null;
  respirationRatePerMinute: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  oxygenLevel: number | null;
  recordedAt: string;
}

export interface CachedEvent {
  eventId: string;
  eventName: string;
  eventLocation: string;
  eventDate: string;
  eventDescription: string;
  isVerified: boolean;
}
