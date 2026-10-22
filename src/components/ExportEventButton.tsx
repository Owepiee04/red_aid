"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listReportsForExport } from "@/lib/data/reports";
import { downloadEventWorkbook } from "@/lib/export";
import type { EventDetail } from "@/types/domain";

/** "Export to Excel" on the admin event page: downloads every submitted report of the event. */
export default function ExportEventButton({ event }: { event: EventDetail }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

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
      toast({
        title: "Export downloaded",
        description: `${reports.length} patient report${reports.length === 1 ? "" : "s"} from ${event.title}.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't export the reports",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={exportNow} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {busy ? "Exporting…" : "Export to Excel"}
    </Button>
  );
}
