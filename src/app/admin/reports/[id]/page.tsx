"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ReportReadOnly from "@/components/ReportReadOnly";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { useData } from "@/lib/useData";
import { getReport, saveAdminNotes } from "@/lib/data/reports";

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { data: report, loading, error, load } = useData(() => getReport(id), [id]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (report) setNotes(report.admin_notes ?? "");
  }, [report]);

  if (loading && !report) return <LoadingState />;
  if (!report) {
    return (
      <EmptyState
        title="Report not found"
        description={error ?? "It may have been removed, or it's still a draft."}
      />
    );
  }

  const saveNotes = async () => {
    setBusy(true);
    try {
      await saveAdminNotes(report.id, notes);
      toast({ title: "Admin notes saved" });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't save notes",
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
          <p className="text-sm text-muted-foreground">
            Charted by {report.charter_name || "—"}
            {report.reviewed_by_name ? ` · reviewed by ${report.reviewed_by_name}` : ""}
          </p>
        </div>
        <StatusBadge status={report.status} className="px-3 py-1 text-sm" />
      </div>

      <div className="space-y-5">
        <ReportReadOnly report={report} />

        {report.status === "reviewed" && report.review_notes && (
          <SectionCard title="Team Leader review notes" subtitle={report.reviewed_by_name ?? undefined}>
            <p className="whitespace-pre-wrap text-sm">{report.review_notes}</p>
          </SectionCard>
        )}

        <SectionCard
          title="Admin Notes"
          subtitle="Oversight comments — separate from the Team Leader's review"
        >
          <Textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add an administrative note about this report"
          />
          <Button
            className="mt-3"
            onClick={saveNotes}
            disabled={busy || !notes.trim() || notes.trim() === (report.admin_notes ?? "")}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : "Save Notes"}
          </Button>
        </SectionCard>
      </div>
    </div>
  );
}
