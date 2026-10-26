import { listReports } from "@/lib/data/reports";
import type { Report } from "@/types/domain";
import type { ReportHistorySource, ReportStatusFilter } from "./types";

export class SupabaseReportHistory implements ReportHistorySource {
  readonly mode = "online" as const;

  async listReports(userId: string, status: ReportStatusFilter): Promise<Report[]> {
    return listReports({
      charterId: userId,
      status: status === "all" ? undefined : status,
      includeDrafts: true,
      limit: 100,
    });
  }
}
