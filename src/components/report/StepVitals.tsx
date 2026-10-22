import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nowTime } from "@/lib/formatting";
import type { VitalForm } from "@/types/report-form";

export const emptyVital = (): VitalForm => ({
  time: nowTime(),
  temp: "",
  pr: "",
  rr: "",
  bp_sys: "",
  bp_dia: "",
  spo2: "",
});

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: "text" | "time";
  placeholder?: string;
  /** Brings up the number keypad on phones without the quirks of type="number". */
  inputMode?: "decimal" | "numeric";
}

function TextField({ label, value, onChange, type = "text", placeholder, inputMode }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface StepVitalsProps {
  vitals: VitalForm[];
  onChange: (next: VitalForm[]) => void;
}

export default function StepVitals({ vitals, onChange }: StepVitalsProps) {
  const update = (index: number, field: keyof VitalForm, next: string) => {
    onChange(vitals.map((item, i) => (i === index ? { ...item, [field]: next } : item)));
  };

  const add = () => onChange([...vitals, emptyVital()]);
  const remove = (index: number) => onChange(vitals.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {vitals.map((vital, index) => (
        // Rows have no id and can be removed from the middle; index keys are
        // fine here because every field is controlled by `vitals`.
        <div key={index} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-heading text-sm font-semibold">Vitals check {index + 1}</p>
            {index > 0 && (
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Remove this vitals check"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TextField
              label="Time"
              type="time"
              value={vital.time}
              onChange={(next) => update(index, "time", next)}
            />
            <TextField
              label="Temp (°C)"
              inputMode="decimal"
              value={vital.temp}
              onChange={(next) => update(index, "temp", next)}
              placeholder="36.5"
            />
            <TextField
              label="PR (bpm)"
              inputMode="numeric"
              value={vital.pr}
              onChange={(next) => update(index, "pr", next)}
              placeholder="80"
            />
            <TextField
              label="RR (/min)"
              inputMode="numeric"
              value={vital.rr}
              onChange={(next) => update(index, "rr", next)}
              placeholder="18"
            />
            <TextField
              label="BP systolic"
              inputMode="numeric"
              value={vital.bp_sys}
              onChange={(next) => update(index, "bp_sys", next)}
              placeholder="120"
            />
            <TextField
              label="BP diastolic"
              inputMode="numeric"
              value={vital.bp_dia}
              onChange={(next) => update(index, "bp_dia", next)}
              placeholder="80"
            />
            <TextField
              label="SpO₂ (%)"
              inputMode="numeric"
              value={vital.spo2}
              onChange={(next) => update(index, "spo2", next)}
              placeholder="98"
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full border-dashed">
        <Plus className="mr-2 h-4 w-4" />
        Add Another Vitals Check
      </Button>
    </div>
  );
}
