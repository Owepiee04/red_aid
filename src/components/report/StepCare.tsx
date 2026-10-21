import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SignaturePad from "@/components/SignaturePad";

interface StepCareProps {
  careGiven: string;
  onCareGiven: (next: string) => void;
  /** PNG data URL from the signature pad, or null while unsigned. */
  signature: string | null;
  onSignature: (next: string | null) => void;
  firstAiderName?: string;
}

export default function StepCare({
  careGiven,
  onCareGiven,
  signature,
  onSignature,
  firstAiderName,
}: StepCareProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Care Given</Label>
        <Textarea
          rows={5}
          value={careGiven}
          onChange={(event) => onCareGiven(event.target.value)}
          placeholder="First aid administered, treatment given, and how the patient responded"
        />
      </div>

      <div className="space-y-2">
        <Label>Signature</Label>
        <SignaturePad onChange={onSignature} />
        <div className="rounded-xl bg-muted/50 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">First Aider</p>
          <p className="text-sm font-medium">{firstAiderName || "—"}</p>
        </div>
        {!signature && (
          <p className="text-xs text-muted-foreground">Draw your signature above to sign this report.</p>
        )}
      </div>
    </div>
  );
}
