import { listMyEvents, todaysDutyFrom } from "@/lib/data/events";
import { submitReport } from "@/lib/data/reports";
import { isChartingOpen } from "@/lib/duty";
import { cacheMyEvents } from "@/lib/indexed-db/cacheEvents";
import { uploadSignature } from "@/lib/storage";
import type { MyEvent } from "@/types/domain";
import type {
  AddVitalsInput,
  CreatePatientInput,
  CreateReportInput,
  ReportDuty,
  ReportFlow,
} from "./types";

function toDuty(event: MyEvent): ReportDuty {
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location,
    verified: event.verified,
  };
}

export class SupabaseReportFlow implements ReportFlow {
  readonly mode = "online" as const;

  private readonly patients = new Map<string, CreatePatientInput>();
  private readonly reports = new Map<string, { input: CreateReportInput; signaturePath: string }>();

  async loadDuty(userId: string, today: string): Promise<ReportDuty | null> {
    const events = await listMyEvents({ userId, limit: 500 });

    await cacheMyEvents(events);

    const event = todaysDutyFrom(events, today);
    return event && isChartingOpen(event) ? toDuty(event) : null;
  }

  async createPatient(input: CreatePatientInput): Promise<void> {
    this.patients.set(input.patientId, input);
  }

  async createReport(input: CreateReportInput): Promise<void> {
    const signaturePath = await uploadSignature(input.reportedBy, input.patientReportId, input.signatureDataUrl);
    this.reports.set(input.patientReportId, { input, signaturePath });
  }

  async addVitals(input: AddVitalsInput): Promise<void> {
    const report = this.reports.get(input.patientReportId);
    if (!report) throw new Error("The report wasn't prepared before its vitals. Please try again.");

    const patient = this.patients.get(report.input.patientId);
    if (!patient) throw new Error("The patient wasn't prepared before the report. Please try again.");

    await submitReport({
      id: input.patientReportId,
      eventId: input.eventId,
      eventDate: input.eventDate,
      chief_complaint: report.input.chiefComplaint,
      patient_name: patient.patientName,
      patient_age: patient.age,
      patient_sex: patient.sex,
      patient_address: patient.address,
      vitals: input.vitals,
      care_given: report.input.careGiven,
      signaturePath: report.signaturePath,
    });
  }
}
