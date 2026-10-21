import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RedAidLogoProps {
  showText?: boolean;
  className?: string;
}

export default function RedAidLogo({ showText = true, className }: RedAidLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/30">
        <Plus className="h-5 w-5 text-white" strokeWidth={3.5} />
      </span>
      {showText && (
        <span className="font-heading text-lg font-extrabold tracking-tight text-foreground">
          RedAid
        </span>
      )}
    </span>
  );
}
