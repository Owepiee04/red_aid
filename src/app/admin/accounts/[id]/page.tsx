"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/SectionCard";
import UserAvatar from "@/components/UserAvatar";
import ReportList from "@/components/ReportList";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { adminReportColumns } from "@/components/reportColumns";
import { useData } from "@/lib/useData";
import { ROLE_LABEL } from "@/lib/roles";
import { fmtDate, fmtTime } from "@/lib/formatting";
import { getProfile } from "@/lib/data/profiles";
import { listDutyHistory } from "@/lib/data/events";
import { listReports } from "@/lib/data/reports";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error } = useData(async () => {
    const person = await getProfile(id);
    if (!person) return null;
    const [dutyHistory, reports] = await Promise.all([
      listDutyHistory(id),
      person.duty_role === "charter" ? listReports({ charterId: id, limit: 50 }) : Promise.resolve([]),
    ]);
    return { person, dutyHistory, reports };
  }, [id]);

  if (loading && !data) return <LoadingState />;
  if (!data) {
    return <EmptyState title="Account not found" description={error ?? undefined} />;
  }

  const { person, dutyHistory, reports } = data;

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-6 flex items-center gap-4">
        <UserAvatar
          uri={person.photo_url}
          name={person.full_name}
          className="h-16 w-16"
          textClassName="text-xl"
        />
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {person.full_name || "Unnamed"}
          </h1>
          <p className="text-sm text-muted-foreground">{person.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
              {person.duty_role ? ROLE_LABEL[person.duty_role] : "Unassigned"}
            </span>
            <span
              className={
                person.active
                  ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                  : "rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {person.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <SectionCard title="Duty History" contentClassName="space-y-3">
          {dutyHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">No duties assigned yet.</p>
          )}
          {dutyHistory.map(({ event, dutyRole }) => (
            <button
              key={`${event.id}-${dutyRole}`}
              type="button"
              onClick={() => router.push(`/admin/events/${event.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-border/70 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{event.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDate(event.date)} · {fmtTime(event.time)}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[dutyRole]}
              </span>
            </button>
          ))}
        </SectionCard>

        {person.duty_role === "charter" && (
          <div>
            <h2 className="mb-3 font-heading text-base font-semibold tracking-tight">
              Report History
            </h2>
            <ReportList
              reports={reports}
              columns={adminReportColumns()}
              emptyTitle="No reports charted yet"
              onOpen={(report) => router.push(`/admin/reports/${report.id}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
