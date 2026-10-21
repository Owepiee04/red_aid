"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ReportReadOnly from "@/components/ReportReadOnly";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { useData } from "@/lib/useData";
import { fmtDateTimeStamp } from "@/lib/formatting";
import { getReport, reviewReport } from "@/lib/data/reports";

export default function ReportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { data: report, loading, error, load } = useData(() => getReport(id), [id]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (report) setNotes(report.review_notes ?? "");
  }, [report]);

  if (loading && !report) return <LoadingState />;
  if (!report) {
    return <EmptyState title="Report not found" description={error ?? undefined} />;
  }

  const markReviewed = async () => {
    setBusy(true);
    try {
      // Who reviewed it and when are recorded by the database, not sent from here.
      await reviewReport(report.id, notes);
      toast({ title: "Report marked as reviewed" });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't mark as reviewed",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{report.patient_name}</h1>
          <p className="text-sm text-muted-foreground">Charted by {report.charter_name || "—"}</p>
        </div>
        <StatusBadge status={report.status} className="px-3 py-1 text-sm" />
      </div>

      <div className="space-y-5">
        <ReportReadOnly report={report} />

        {report.status === "reviewed" ? (
          <SectionCard title="Review Notes">
            <p className="whitespace-pre-wrap text-sm">{report.review_notes || "No notes added."}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
              <StatusBadge status="reviewed" />
              <span className="text-xs text-muted-foreground">
                Reviewed by {report.reviewed_by_name || "—"} · {fmtDateTimeStamp(report.reviewed_at)}
              </span>
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title="Review Notes"
            subtitle="Add your findings before marking this report reviewed"
          >
            <Textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes for the record"
            />
            <Button className="mt-3" onClick={markReviewed} disabled={busy}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {busy ? "Saving…" : "Mark as Reviewed"}
            </Button>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
