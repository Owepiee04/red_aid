import type { SubmitReportInput } from "@/lib/data/reports";
import type { MyEvent } from "@/types/domain";
import type { PatientForm, VitalForm } from "@/types/report-form";

/** Everything submitReport() needs, except the signature path (made when uploading). */
export type QueuedReportInput = Omit<SubmitReportInput, "signaturePath">;

/**
 * waiting          = not sent yet (no signal, or sending right now)
 * needs_attention  = the server refused it (e.g. the duty is closed); `problem` says why.
 *                    It is still retried automatically, and with "Send now".
 */
export type QueuedReportStatus = "waiting" | "needs_attention";

/** A submitted report saved on this phone until the server confirms it. */
export interface QueuedReport {
  /** The report's own id (patient_reports.id). Sending twice can't duplicate it. */
  id: string;
  /** Who wrote it. It is only ever sent while this person is logged in. */
  userId: string;
  eventTitle: string;
  input: QueuedReportInput;
  /** The signature as a PNG data URL (uploaded to Storage when sent). */
  signature: string;
  /** Set once the signature is in Storage, so a retry doesn't upload it again. */
  signaturePath?: string | null;
  /** When the charter tapped Submit (ISO). */
  savedAt: string;
  attempts: number;
  lastTriedAt: string | null;
  status: QueuedReportStatus;
  /** Shown to the charter when status is needs_attention. */
  problem: string | null;
}

/** A New Report form that was being filled in, so it survives the app closing. */
export interface ReportDraft {
  userId: string;
  eventId: string;
  /** Kept so a restored form still can't create a duplicate report. */
  reportId: string;
  step: number;
  patient: PatientForm;
  vitals: VitalForm[];
  care: string;
  /** ISO time of the last change. */
  savedAt: string;
}

/** The last duty seen online, used to open New Report while offline. No patient data. */
export interface DutySnapshot {
  userId: string;
  /** YYYY-MM-DD the snapshot is for. */
  date: string;
  duty: MyEvent | null;
  /** ISO time it was saved. */
  savedAt: string;
}
