import type { Sex } from "@/types/domain";

/** One row of the vitals form. Everything is a string because it comes from inputs. */
export interface VitalFormRow {
  time: string; // "HH:MM"
  temp: string;
  pr: string;
  rr: string;
  bp_sys: string;
  bp_dia: string;
  spo2: string;
}

export interface ReportDuty {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  verified: boolean;
}

export interface CreatePatientInput {
  patientId: string;
  eventId: string;
  patientName: string;
  studentId: string | null;
  age: string;
  sex: Sex;
  address: string;
  addedBy: string;
  recordedAt: string;
}

export interface CreateReportInput {
  patientReportId: string;
  patientId: string;
  chiefComplaint: string;
  careGiven: string;
  signatureDataUrl: string;
  reportedBy: string;
  recordedAt: string;
}

export interface AddVitalsInput {
  patientReportId: string;
  eventId: string;
  eventDate: string;
  vitals: VitalFormRow[];
}

export interface ReportFlow {
  readonly mode: "online" | "offline";
  loadDuty(userId: string, today: string): Promise<ReportDuty | null>;
  createPatient(input: CreatePatientInput): Promise<void>;
  createReport(input: CreateReportInput): Promise<void>;
  addVitals(input: AddVitalsInput): Promise<void>;
}
