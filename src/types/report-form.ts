export type { VitalFormRow as VitalForm } from "@/lib/data/reports";

export interface PatientForm {
  chief_complaint: string;
  patient_name: string;
  patient_age: string;
  patient_sex: "M" | "F";
  patient_address: string;
}
