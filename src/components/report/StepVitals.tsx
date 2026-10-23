import { AlertTriangle, Info, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nowTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { VITAL_RULES, checkVitalsRow, cleanNumberInput, type FieldCheck, type VitalField } from "@/lib/vitals";
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

const MEASUREMENTS = ["temp", "pr", "rr", "bp_sys", "bp_dia", "spo2"] as const;

/** True when at least one measurement was entered (the time alone doesn't count). */
export const hasMeasurements = (vital: VitalForm): boolean =>
  MEASUREMENTS.some((field) => vital[field].trim() !== "");

interface TimeFieldProps {
  value: string;
  onChange: (next: string) => void;
}

function TimeField({ value, onChange }: TimeFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Time</Label>
      <Input type="time" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

interface NumberFieldProps {
  field: VitalField;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  check?: FieldCheck;
  id: string;
}

/**
 * A vitals box that only accepts numbers: letters and symbols are dropped as
 * you type (temperature also takes one decimal place). Impossible values show
 * a red message and block Next; unusual ones show an amber "double-check".
 */
function NumberField({ field, label, value, onChange, placeholder, check, id }: NumberFieldProps) {
  const rule = VITAL_RULES[field];
  const message = check?.error ?? check?.warning;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode={rule.decimal ? "decimal" : "numeric"}
        pattern={rule.decimal ? "[0-9]*[.,]?[0-9]?" : "[0-9]*"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={!!check?.error}
        aria-describedby={message ? `${id}-msg` : undefined}
        onChange={(event) => onChange(cleanNumberInput(event.target.value, rule))}
        className={cn(
          check?.error && "border-destructive focus-visible:ring-destructive",
          !check?.error && check?.warning && "border-amber-400 focus-visible:ring-amber-400"
        )}
      />
      {message && (
        <p
          id={`${id}-msg`}
          className={cn(
            "flex items-start gap-1 text-[11px] leading-tight",
            check?.error ? "text-destructive" : "text-amber-700"
          )}
        >
          {!check?.error && <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  );
}

const FIELDS: { field: VitalField; label: string; placeholder: string }[] = [
  { field: "temp", label: "Temp (°C)", placeholder: "36.5" },
  { field: "pr", label: "PR (bpm)", placeholder: "80" },
  { field: "rr", label: "RR (/min)", placeholder: "18" },
  { field: "bp_sys", label: "BP systolic", placeholder: "120" },
  { field: "bp_dia", label: "BP diastolic", placeholder: "80" },
  { field: "spo2", label: "SpO₂ (%)", placeholder: "98" },
];

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
      <p className="flex gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Vitals are optional. For a minor case, like a small scrape, you can leave them blank and
          tap Next. Fill in only what you measured; empty checks aren&apos;t saved. Boxes take numbers
          only; a red message must be fixed before Next, an amber one is just a reminder to double-check.
        </span>
      </p>

      {vitals.length === 0 && (
        <p className="py-2 text-center text-sm text-muted-foreground">No vitals recorded for this patient.</p>
      )}

      {vitals.map((vital, index) => (
        // Rows have no id and can be removed from the middle; index keys are
        // fine here because every field is controlled by `vitals`.
        <div key={index} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-heading text-sm font-semibold">Vitals check {index + 1}</p>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove this vitals check"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <VitalsGrid index={index} vital={vital} update={update} />
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full border-dashed">
        <Plus className="mr-2 h-4 w-4" />
        {vitals.length === 0 ? "Add Vitals Check" : "Add Another Vitals Check"}
      </Button>
    </div>
  );
}

function VitalsGrid({
  index,
  vital,
  update,
}: {
  index: number;
  vital: VitalForm;
  update: (index: number, field: keyof VitalForm, next: string) => void;
}) {
  const checks = checkVitalsRow(vital);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <TimeField value={vital.time} onChange={(next) => update(index, "time", next)} />
      {FIELDS.map(({ field, label, placeholder }) => (
        <NumberField
          key={field}
          id={`vital-${index}-${field}`}
          field={field}
          label={label}
          value={vital[field]}
          onChange={(next) => update(index, field, next)}
          placeholder={placeholder}
          check={checks[field]}
        />
      ))}
    </div>
  );
}
