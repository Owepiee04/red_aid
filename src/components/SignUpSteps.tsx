import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Your details" },
  { n: 2, label: "Verify email" },
] as const;

/** "Step 1 of 2" indicator shared by the sign-up and verify pages. */
export default function SignUpSteps({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-3 text-xs font-medium text-muted-foreground">
      {STEPS.map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-3">
          {i > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
          <span className={cn("flex items-center gap-1.5", n === current && "text-foreground")}>
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                n === current
                  ? "bg-primary text-primary-foreground"
                  : n < current
                    ? "bg-primary/15 text-primary"
                    : "bg-muted"
              )}
            >
              {n < current ? <Check className="h-3 w-3" /> : n}
            </span>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
