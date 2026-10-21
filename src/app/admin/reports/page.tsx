"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
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
import { adminReportColumns } from "@/components/reportColumns";
import { useData } from "@/lib/useData";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fmtDate } from "@/lib/formatting";
import { listReports } from "@/lib/data/reports";
import { listEventOptions } from "@/lib/data/events";

type StatusFilter = "all" | "submitted" | "reviewed";

export default function AllReportsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [eventId, setEventId] = useState("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: events } = useData(() => listEventOptions(100), []);

  const { data: reports, loading, error } = useData(
    () =>
      listReports({
        status: status === "all" ? undefined : status,
        eventId: eventId === "all" ? undefined : eventId,
        search: debouncedSearch,
        limit: 100,
      }),
    [debouncedSearch, status, eventId]
  );

  const count = reports?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="All Reports"
        description={`${count} report${count === 1 ? "" : "s"} found`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient name"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {(events ?? []).map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.title} · {fmtDate(event.date, "MMM D")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load reports: {error}</p>}

      {!reports && loading ? (
        <LoadingState />
      ) : (
        <ReportList
          reports={reports ?? []}
          columns={adminReportColumns()}
          emptyTitle="No reports match these filters"
          onOpen={(report) => router.push(`/admin/reports/${report.id}`)}
        />
      )}
    </div>
  );
}
