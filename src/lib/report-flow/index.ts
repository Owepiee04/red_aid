import { IndexedDbReportFlow } from "./indexeddb";
import { SupabaseReportFlow } from "./supabase";
import type { ReportFlow } from "./types";

export type {
  AddVitalsInput,
  CreatePatientInput,
  CreateReportInput,
  ReportDuty,
  ReportFlow,
  VitalFormRow,
} from "./types";

export function getReportFlow(online: boolean): ReportFlow {
  return online ? new SupabaseReportFlow() : new IndexedDbReportFlow();
}
