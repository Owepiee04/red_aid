export type Sex = "M" | "F" | "Others";

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
  temperature: number;
  pulseRatePerMinute: number;
  respirationRatePerMinute: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenLevel: number;
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
