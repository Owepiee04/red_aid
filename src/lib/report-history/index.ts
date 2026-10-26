import { IndexedDbReportHistory } from "./indexeddb";
import { SupabaseReportHistory } from "./supabase";
import type { ReportHistorySource } from "./types";

export type { ReportHistorySource, ReportStatusFilter } from "./types";

export function getReportHistorySource(online: boolean): ReportHistorySource {
  return online ? new SupabaseReportHistory() : new IndexedDbReportHistory();
}
