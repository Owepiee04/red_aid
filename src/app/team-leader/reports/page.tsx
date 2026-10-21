"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import ReportList from "@/components/ReportList";
import LoadingState from "@/components/LoadingState";
import { dutyReportColumns } from "@/components/reportColumns";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { listMyEvents } from "@/lib/data/events";
import { listReports } from "@/lib/data/reports";

type StatusFilter = "all" | "submitted" | "reviewed";

export default function DutyReportsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data: reports, loading, error } = useData(async () => {
    if (!userId) return [];
    // Every report from any event this person leads (not just the ones where
    // they were saved as "the" team leader, so co-leaders see them too).
    const led = await listMyEvents({ userId, dutyRole: "team_leader", limit: 500 });
    return listReports({
      eventIds: led.map((event) => event.id),
      status: status === "all" ? undefined : status,
      limit: 100,
    });
  }, [userId, status]);

  return (
    <div>
      <PageHeader
        title="Duty Reports"
        description="Every report charted during your duties."
        actions={
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load reports: {error}</p>}

      {!reports && loading ? (
        <LoadingState />
      ) : (
        <ReportList
          reports={reports ?? []}
          columns={dutyReportColumns()}
          emptyTitle="No reports on your duties yet"
          onOpen={(report) => router.push(`/team-leader/reports/${report.id}`)}
        />
      )}
    </div>
  );
}
