import { Fragment } from "react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  step: number;
  total?: number;
}

export default function StepIndicator({ step, total = 3 }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, index) => index + 1).map((number) => (
        <Fragment key={number}>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              number <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {number}
          </span>
          {number < total && (
            <span className={cn("h-0.5 w-6 rounded-full", number < step ? "bg-primary" : "bg-muted")} />
          )}
        </Fragment>
      ))}
      <span className="ml-2 text-xs font-medium text-muted-foreground">
        Step {step} of {total}
      </span>
    </div>
  );
}
