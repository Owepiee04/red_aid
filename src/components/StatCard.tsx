import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  default: "text-foreground",
  warning: "text-amber-600",
  accent: "text-primary",
  success: "text-emerald-600",
} as const;

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: keyof typeof TONES;
  onClick?: () => void;
}

export default function StatCard({ label, value, hint, icon: Icon, tone = "default", onClick }: StatCardProps) {
  const className = cn(
    "rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all",
    onClick && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={cn("mt-3 font-heading text-3xl font-bold tracking-tight", TONES[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );

  // Two explicit branches instead of a dynamic tag name keeps TypeScript happy
  // and avoids passing `type` to a <div>.
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
