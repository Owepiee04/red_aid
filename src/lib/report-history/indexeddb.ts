import * as PatientStore from "@/lib/indexed-db/Patient";
import * as PatientReportStore from "@/lib/indexed-db/PatientReport";
import * as VitalSignStore from "@/lib/indexed-db/VitalSign";
import { getEvents } from "@/lib/indexed-db/Event";
import type { OfflinePatient, OfflinePatientReport, OfflineVitalSign } from "@/lib/indexed-db/types";
import type { Report } from "@/types/domain";
import type { ReportHistorySource, ReportStatusFilter } from "./types";

function toReport(
  report: OfflinePatientReport,
  patient: OfflinePatient,
  event: { eventId: string; eventName: string; eventDate: string; eventLocation: string } | undefined,
  vitals: OfflineVitalSign[]
): Report {
  return {
    id: report.patientReportId,
    event_id: patient.eventId,
    charter_id: report.reportedBy,
    team_leader_id: null,
    patient_id: report.patientId,
    student_id: patient.studentId,
    chief_complaint: report.chiefComplaint,
    patient_name: patient.patientName,
    age: patient.age,
    sex: patient.sex,
    address: patient.address,
    care_given: report.careGiven,
    signature_url: null,
    status: "submitted",
    pending_sync: true,
    review_notes: null,
    admin_notes: null,
    reviewed_by: null,
    submitted_at: report.recordedAt,
    reviewed_at: null,
    synced_at: null,
    created_at: report.recordedAt,
    updated_at: report.recordedAt,
    event_title: event?.eventName ?? null,
    event_date: event?.eventDate ?? null,
    event_location: event?.eventLocation || null,
    charter_name: null,
    team_leader_name: null,
    reviewed_by_name: null,
    vitals_readings: vitals
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map((vital) => ({
        id: vital.vitalId,
        report_id: vital.patientReportId,
        time_taken: vital.recordedAt,
        temp: vital.temperature,
        pr: vital.pulseRatePerMinute,
        rr: vital.respirationRatePerMinute,
        bp_systolic: vital.bloodPressureSystolic,
        bp_diastolic: vital.bloodPressureDiastolic,
        spo2: vital.oxygenLevel,
      })),
  };
}

export class IndexedDbReportHistory implements ReportHistorySource {
  readonly mode = "offline" as const;

  async listReports(userId: string, status: ReportStatusFilter): Promise<Report[]> {
    if (status === "draft" || status === "reviewed") return [];

    const [reports, patients, events, vitals] = await Promise.all([
      PatientReportStore.getByReporter(userId),
      PatientStore.getAll(),
      getEvents(),
      VitalSignStore.getAll(),
    ]);

    const patientsById = new Map(patients.map((patient) => [patient.patientId, patient]));
    const eventsById = new Map(events.map((event) => [event.eventId, event]));
    const vitalsByReport = new Map<string, OfflineVitalSign[]>();

    for (const vital of vitals) {
      const list = vitalsByReport.get(vital.patientReportId) ?? [];
      list.push(vital);
      vitalsByReport.set(vital.patientReportId, list);
    }

    return reports
      .map((report) => {
        const patient = patientsById.get(report.patientId);
        if (!patient) return null;
        return toReport(
          report,
          patient,
          eventsById.get(patient.eventId),
          vitalsByReport.get(report.patientReportId) ?? []
        );
      })
      .filter((report): report is Report => report !== null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100);
  }
}
