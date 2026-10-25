"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listReportsForExport } from "@/lib/data/reports";
import { markEventExported } from "@/lib/data/events";
import { EXPORT_RETENTION_DAYS, patientDataDeletesAt } from "@/lib/duty";
import { fmtDateLong } from "@/lib/formatting";
import { downloadEventWorkbook } from "@/lib/export";
import type { EventDetail } from "@/types/domain";

interface ExportEventButtonProps {
  event: EventDetail;
  /** Called after the first export, so the page can show the deletion date. */
  onExported?: () => void;
}

/**
 * "Export to Excel" on the admin event page: downloads every report of the event.
 * The FIRST export starts a countdown: EXPORT_RETENTION_DAYS later the event's
 * patient data is permanently deleted (the daily cleanup job). So the first
 * time, it asks to confirm and explains that.
 */
export default function ExportEventButton({ event, onExported }: ExportEventButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const alreadyExported = !!event.exported_at;
  const deletesAt = patientDataDeletesAt(event);

  const exportNow = async () => {
    setBusy(true);
    try {
      const reports = await listReportsForExport(event.id);
      if (reports.length === 0) {
        toast({
          title: "No reports to export yet",
          description: "Only submitted and reviewed reports are exported.",
        });
        return;
      }
      await downloadEventWorkbook(event, reports, user?.full_name || user?.email);

      let countdownNote = "";
      if (!alreadyExported) {
        try {
          await markEventExported(event.id);
          const when = new Date(Date.now() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
          countdownNote = ` Patient data will be deleted from RedAid on ${fmtDateLong(when.toISOString())}.`;
          onExported?.();
        } catch {
          // The file is already downloaded; not starting the countdown is the safe failure.
        }
      }
      toast({
        title: "Export downloaded",
        description: `${reports.length} patient report${reports.length === 1 ? "" : "s"} from ${event.title}.${countdownNote}`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't export the reports",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => (alreadyExported ? exportNow() : setConfirmOpen(true))}
        disabled={busy || !!event.patient_data_deleted_at}
        title={
          event.patient_data_deleted_at
            ? "This event's patient data was deleted after export"
            : deletesAt
              ? `Patient data will be deleted on ${fmtDateLong(deletesAt.toISOString())}`
              : undefined
        }
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        {busy ? "Exporting…" : "Export to Excel"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !busy && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export and start the {EXPORT_RETENTION_DAYS}-day countdown?</AlertDialogTitle>
            <AlertDialogDescription>
              The Excel file downloads now. {EXPORT_RETENTION_DAYS} days after this first export, the patient
              records, vitals, notes and signatures for “{event.title}” are{" "}
              <strong>permanently deleted from RedAid</strong> to protect patients&apos; privacy. Keep the Excel
              file somewhere safe. Exporting again later won&apos;t change the date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                exportNow();
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
