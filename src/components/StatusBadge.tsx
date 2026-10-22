import { cn } from "@/lib/utils";
import { REPORT_STATUS, VERIFICATION_STATUS } from "@/lib/formatting";

interface StatusBadgeProps {
  /** A report status ("draft" | "submitted" | "reviewed") or, with kind="verification", "verified" | "pending". */
  status: string | null | undefined;
  kind?: "report" | "verification";
  className?: string;
}

type BadgeMeta = { label: string; className: string };

export default function StatusBadge({ status, kind = "report", className }: StatusBadgeProps) {
  const map: Record<string, BadgeMeta> = kind === "verification" ? VERIFICATION_STATUS : REPORT_STATUS;
  const meta: BadgeMeta = (status ? map[status] : undefined) ?? {
    label: status || "—",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
