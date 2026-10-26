import * as PatientStore from "@/lib/indexed-db/Patient";
import * as PatientReportStore from "@/lib/indexed-db/PatientReport";
import * as VitalSignStore from "@/lib/indexed-db/VitalSign";
import { getEvents } from "@/lib/indexed-db/Event";
import { dataUrlToBlob } from "@/lib/storage";
import { parseAge, parseVitalRows } from "./parse";
import type {
  AddVitalsInput,
  CreatePatientInput,
  CreateReportInput,
  ReportDuty,
  ReportFlow,
} from "./types";

export class IndexedDbReportFlow implements ReportFlow {
  readonly mode = "offline" as const;

  async loadDuty(_userId: string, today: string): Promise<ReportDuty | null> {
    const events = await getEvents();
    const event = events.find((item) => item.eventDate === today && item.isVerified);
    if (!event) return null;

    return {
      id: event.eventId,
      title: event.eventName,
      date: event.eventDate,
      time: null,
      location: event.eventLocation || null,
      verified: event.isVerified,
    };
  }

  async createPatient(input: CreatePatientInput): Promise<void> {
    await PatientStore.create({
      patientId: input.patientId,
      patientName: input.patientName.trim(),
      studentId: input.studentId,
      age: parseAge(input.age),
      sex: input.sex,
      eventId: input.eventId,
      address: input.address.trim(),
      addedBy: input.addedBy,
      recordedAt: input.recordedAt,
    });
  }

  async createReport(input: CreateReportInput): Promise<void> {
    await PatientReportStore.create({
      patientReportId: input.patientReportId,
      patientId: input.patientId,
      chiefComplaint: input.chiefComplaint.trim(),
      careGiven: input.careGiven.trim(),
      signatureBlob: dataUrlToBlob(input.signatureDataUrl),
      reportedBy: input.reportedBy,
      recordedAt: input.recordedAt,
    });
  }

  async addVitals(input: AddVitalsInput): Promise<void> {
    const rows = parseVitalRows(input.eventDate, input.vitals);

    const existing = await VitalSignStore.getByReport(input.patientReportId);
    for (const vital of existing) {
      await VitalSignStore.remove(vital.vitalId);
    }

    for (const row of rows) {
      await VitalSignStore.create({
        patientReportId: input.patientReportId,
        temperature: row.temperature,
        pulseRatePerMinute: row.pulse_rate_per_minute,
        respirationRatePerMinute: row.respiration_rate_per_minute,
        bloodPressureSystolic: row.blood_pressure_systolic,
        bloodPressureDiastolic: row.blood_pressure_diastolic,
        oxygenLevel: row.oxygen_level,
        recordedAt: row.created_at,
      });
    }
  }
}
