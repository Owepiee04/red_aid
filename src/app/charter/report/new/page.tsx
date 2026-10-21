"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import LoadingState from "@/components/LoadingState";
import StepIndicator from "@/components/report/StepIndicator";
import StepPatient from "@/components/report/StepPatient";
import StepVitals, { emptyVital } from "@/components/report/StepVitals";
import StepCare from "@/components/report/StepCare";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtTime, todayISO } from "@/lib/formatting";
import { getTodaysDuty } from "@/lib/data/events";
import { submitReport } from "@/lib/data/reports";
import { uploadSignature } from "@/lib/storage";
import type { PatientForm, VitalForm } from "@/types/report-form";

export default function NewReportPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [patient, setPatient] = useState<PatientForm>({
    chief_complaint: "",
    patient_name: "",
    patient_age: "",
    patient_sex: "M",
    patient_address: "",
  });
  const [vitals, setVitals] = useState<VitalForm[]>(() => [emptyVital()]);
  const [care, setCare] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  // Created once per form, so pressing Submit again after a network hiccup
  // can't produce two copies of the same report.
  const reportId = useRef<string>("");
  if (!reportId.current) reportId.current = crypto.randomUUID();

  // Only a duty the charter is VERIFIED for lets them chart.
  const { data: duty, loading } = useData(async () => {
    if (!userId) return null;
    const event = await getTodaysDuty(userId, todayISO());
    return event?.verified ? event : null;
  }, [userId]);

  const redirected = useRef(false);
  useEffect(() => {
    if (loading || duty || redirected.current) return;
    redirected.current = true;
    toast({ title: "You need Team Leader approval before charting." });
    router.replace("/charter");
  }, [loading, duty, toast, router]);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.push("/charter"), 1500);
    return () => clearTimeout(timer);
  }, [submitted, router]);

  if (loading || !duty || !userId) return <LoadingState />;

  const stepOneComplete =
    patient.chief_complaint.trim() !== "" &&
    patient.patient_name.trim() !== "" &&
    patient.patient_age !== "" &&
    patient.patient_address.trim() !== "";

  const stepTwoComplete = vitals.every(
    (v) => v.time && v.temp && v.pr && v.rr && v.bp_sys && v.bp_dia && v.spo2
  );

  const stepThreeComplete = care.trim() !== "" && signature !== null;

  const submit = async () => {
    if (!signature) return;
    setBusy(true);
    try {
      const signaturePath = await uploadSignature(userId, reportId.current, signature);
      await submitReport({
        id: reportId.current,
        eventId: duty.id,
        eventDate: duty.date,
        ...patient,
        vitals,
        care_given: care,
        signaturePath,
      });
      toast({ title: "Report submitted" });
      setSubmitted(true);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't submit the report",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight">Report submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">Coming back to your home dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New Report" description={`${duty.title} · ${fmtTime(duty.time)}`} />

      <div className="mb-5">
        <StepIndicator step={step} />
      </div>

      <SectionCard
        title={step === 1 ? "Patient & complaint" : step === 2 ? "Vitals" : "Care given & signature"}
      >
        {step === 1 && <StepPatient value={patient} onChange={setPatient} eventLabel={duty.title} />}
        {step === 2 && <StepVitals vitals={vitals} onChange={setVitals} />}
        {step === 3 && (
          <StepCare
            careGiven={care}
            onCareGiven={setCare}
            signature={signature}
            onSignature={setSignature}
            firstAiderName={user?.full_name ?? undefined}
          />
        )}
      </SectionCard>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          disabled={step === 1 || busy}
        >
          Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep((current) => current + 1)}
            disabled={step === 1 ? !stepOneComplete : !stepTwoComplete}
          >
            Next
          </Button>
        ) : (
          <Button onClick={submit} disabled={!stepThreeComplete || busy}>
            {busy ? "Submitting…" : "Submit Report"}
          </Button>
        )}
      </div>
    </div>
  );
}
