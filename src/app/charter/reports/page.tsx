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
import ReportCardList from "@/components/ReportCardList";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { listReports } from "@/lib/data/reports";
import type { ReportStatus } from "@/types/domain";

type StatusFilter = "all" | ReportStatus;

export default function MyReportsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data: reports, loading, error } = useData(
    () =>
      userId
        ? listReports({
            charterId: userId,
            status: status === "all" ? undefined : status,
            includeDrafts: true,
            limit: 100,
          })
        : Promise.resolve([]),
    [userId, status]
  );

  return (
    <div>
      <PageHeader
        title="My Reports"
        description="Every report you've charted."
        actions={
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
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
        <ReportCardList
          reports={reports ?? []}
          emptyTitle="No reports match this filter"
          onOpen={(report) => router.push(`/charter/reports/${report.id}`)}
        />
      )}
    </div>
  );
}
