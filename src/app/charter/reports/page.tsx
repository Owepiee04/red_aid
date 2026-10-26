"use client";

import { useEffect, useState } from "react";
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
import { checkConnection } from "@/lib/connectivity";
import { getReportHistorySource, type ReportStatusFilter } from "@/lib/report-history";

type StatusFilter = ReportStatusFilter;

export default function MyReportsPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (reachable: boolean) => {
      if (!cancelled) setOnline(reachable);
    };

    const refresh = async () => {
      apply(await checkConnection());
    };

    void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => apply(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const {
    data: reports,
    loading: queryLoading,
    error,
  } = useData(
    () =>
      userId && online !== null
        ? getReportHistorySource(online).listReports(userId, status)
        : Promise.resolve([]),
    [userId, status, online]
  );

  const loading = online === null || queryLoading;

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

      {online === null || (loading && !reports?.length) ? (
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
