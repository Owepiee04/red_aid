import type { Report, ReportStatus } from "@/types/domain";

export type ReportStatusFilter = "all" | ReportStatus;

export interface ReportHistorySource {
  readonly mode: "online" | "offline";
  listReports(userId: string, status: ReportStatusFilter): Promise<Report[]>;
}
