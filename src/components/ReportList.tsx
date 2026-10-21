import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import type { Report } from "@/types/domain";

export interface ReportColumn {
  key: string;
  label: string;
  render?: (report: Report) => ReactNode;
}

interface ReportListProps {
  reports?: Report[];
  columns?: ReportColumn[];
  onOpen?: (report: Report) => void;
  emptyTitle?: string;
}

/** Table of patient reports. Columns: [{ key, label, render(row) }]. */
export default function ReportList({
  reports = [],
  columns = [],
  onOpen,
  emptyTitle = "No reports yet",
}: ReportListProps) {
  if (!reports.length) {
    return (
      <EmptyState icon={ClipboardList} title={emptyTitle} description="Nothing has been charted here yet." />
    );
  }

  const plainValue = (report: Report, key: string): ReactNode => {
    const value = (report as unknown as Record<string, unknown>)[key];
    return value === null || value === undefined || value === "" ? "—" : String(value);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                onClick={onOpen ? () => onOpen(report) : undefined}
                className={cn(
                  "border-t border-border/70 transition-colors",
                  onOpen && "cursor-pointer hover:bg-muted/40"
                )}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle">
                    {column.render ? column.render(report) : plainValue(report, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
