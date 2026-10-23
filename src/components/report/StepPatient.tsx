import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AGE_MAX, checkAge, cleanNumberInput } from "@/lib/vitals";
import type { PatientForm } from "@/types/report-form";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const SEX_OPTIONS = ["M", "F"] as const;

interface StepPatientProps {
  value: PatientForm;
  onChange: (next: PatientForm) => void;
  eventLabel: string;
}

export default function StepPatient({ value, onChange, eventLabel }: StepPatientProps) {
  const set = <K extends keyof PatientForm>(field: K, next: PatientForm[K]) =>
    onChange({ ...value, [field]: next });
  const ageError = checkAge(value.patient_age).error;

  return (
    <div className="space-y-5">
      <Field label="Event">
        <Input value={eventLabel} readOnly className="bg-muted/50" />
      </Field>

      <Field label="Chief Complaint">
        <Textarea
          rows={3}
          value={value.chief_complaint}
          onChange={(e) => set("chief_complaint", e.target.value)}
          placeholder="Why the patient came in for care"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Patient Name" className="sm:col-span-2">
          <Input
            value={value.patient_name}
            onChange={(e) => set("patient_name", e.target.value)}
            placeholder="Full name"
          />
        </Field>
        <Field label="Age">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value.patient_age}
            // Digits only (no "e", "-" or decimals), up to 3 of them.
            onChange={(e) => set("patient_age", cleanNumberInput(e.target.value, { maxDigits: 3 }))}
            placeholder="Years"
            aria-invalid={!!ageError}
            aria-describedby={ageError ? "patient-age-msg" : undefined}
            className={cn(ageError && "border-destructive focus-visible:ring-destructive")}
          />
          {ageError && (
            <p id="patient-age-msg" className="text-xs text-destructive">
              {ageError}
            </p>
          )}
        </Field>
      </div>

      <Field label="Sex">
        <div className="inline-flex rounded-xl border border-border p-1">
          {SEX_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => set("patient_sex", option)}
              className={cn(
                "w-16 rounded-lg py-1.5 text-sm font-medium transition-colors",
                value.patient_sex === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Address">
        <Input
          value={value.patient_address}
          onChange={(e) => set("patient_address", e.target.value)}
          placeholder="Street, barangay, city"
        />
      </Field>
    </div>
  );
}
