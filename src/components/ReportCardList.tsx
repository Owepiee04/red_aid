import { ChevronRight, ClipboardList } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { submittedStamp } from "@/lib/formatting";
import type { Report } from "@/types/domain";

interface ReportCardListProps {
  reports?: Report[];
  onOpen?: (report: Report) => void;
  emptyTitle?: string;
}

/** Card list of a charter's own reports — comfortable on a phone. */
export default function ReportCardList({
  reports = [],
  onOpen,
  emptyTitle = "No reports yet",
}: ReportCardListProps) {
  if (!reports.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={emptyTitle}
        description="Reports you chart on duty will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <button
          key={report.id}
          type="button"
          onClick={() => onOpen?.(report)}
          className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-heading text-base font-semibold">
              {report.patient_name || "Unnamed patient"}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {report.event_title || "—"}
            </span>
            <span className="mt-2 flex items-center gap-2">
              <StatusBadge status={report.status} />
              <span className="text-xs text-muted-foreground">
                {report.status === "draft"
                  ? "Not submitted yet"
                  : `Submitted ${submittedStamp(report, "MMM D, YYYY · h:mm A")}`}
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
