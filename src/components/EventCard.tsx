import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtTime } from "@/lib/formatting";

interface EventCardProps {
  event: { title: string; time: string | null; location: string | null };
  onClick?: () => void;
  badge?: ReactNode;
  className?: string;
}

export default function EventCard({ event, onClick, badge, className }: EventCardProps) {
  const classes = cn(
    "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all",
    onClick && "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
    className
  );

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-semibold">{event.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {fmtTime(event.time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      {badge}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}
