import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  /** Shown on the right of the header, e.g. a button. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            {title && <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}
