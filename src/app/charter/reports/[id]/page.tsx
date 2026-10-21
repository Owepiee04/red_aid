"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportReadOnly from "@/components/ReportReadOnly";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { useData } from "@/lib/useData";
import { fmtDateTimeStamp } from "@/lib/formatting";
import { getReport } from "@/lib/data/reports";

export default function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: report, loading, error } = useData(() => getReport(id), [id]);

  if (loading && !report) return <LoadingState />;
  if (!report) {
    return <EmptyState title="Report not found" description={error ?? undefined} />;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{report.patient_name}</h1>
          <p className="text-sm text-muted-foreground">{report.event_title}</p>
        </div>
        <StatusBadge status={report.status} className="px-3 py-1 text-sm" />
      </div>

      <div className="space-y-5">
        <ReportReadOnly report={report} />

        {report.status === "reviewed" && (
          <SectionCard title="Team Leader review">
            <p className="whitespace-pre-wrap text-sm">{report.review_notes || "No notes added."}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
              <StatusBadge status="reviewed" />
              <span className="text-xs text-muted-foreground">
                {report.reviewed_by_name || "—"} · {fmtDateTimeStamp(report.reviewed_at)}
              </span>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
