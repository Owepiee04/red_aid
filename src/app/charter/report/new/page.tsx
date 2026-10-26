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
import StepVitals, { emptyVital, hasMeasurements } from "@/components/report/StepVitals";
import { checkAge, hasVitalsErrors } from "@/lib/vitals";
import StepCare from "@/components/report/StepCare";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtTime, todayISO } from "@/lib/formatting";
import { checkConnection } from "@/lib/connectivity";
import { getReportFlow } from "@/lib/report-flow";
import type { PatientForm, VitalForm } from "@/types/report-form";

export default function NewReportPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  const offlineNotified = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (reachable: boolean) => {
      if (cancelled) return;
      setOnline(reachable);
      if (!reachable && !offlineNotified.current) {
        offlineNotified.current = true;
        toast({
          title: "User is offline, now utilizing offline database.",
          duration: 4000,
        });
      }
      if (reachable) offlineNotified.current = false;
    };

    const refresh = async () => {
      const reachable = await checkConnection();
      apply(reachable);
    };

    void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => apply(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [toast]);

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
  const patientId = useRef<string>("");
  if (!patientId.current) patientId.current = crypto.randomUUID();

  const dutyKey = userId && online !== null ? `${userId}:${online}` : null;
  const dutyKeyRef = useRef(dutyKey);
  dutyKeyRef.current = dutyKey;
  const [loadedDutyKey, setLoadedDutyKey] = useState<string | null>(null);

  const { data: duty, loading: dutyLoading } = useData(async () => {
    if (!dutyKey || !userId || online === null) return null;
    try {
      return await getReportFlow(online).loadDuty(userId, todayISO());
    } finally {
      if (dutyKeyRef.current === dutyKey) setLoadedDutyKey(dutyKey);
    }
  }, [dutyKey, userId, online]);

  const loading = dutyKey === null || dutyLoading || loadedDutyKey !== dutyKey;

  const redirected = useRef(false);
  useEffect(() => {
    if (loading || duty || redirected.current) return;
    redirected.current = true;
    toast({ title: "Charting isn't open — you need Team Leader approval for a duty that hasn't ended." });
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
    !checkAge(patient.patient_age).error &&
    patient.patient_address.trim() !== "";

  // Vitals are optional: a check can be left blank or partly filled. The only rule
  // is that a check with any measurement in it needs a time.
  // Impossible values (e.g. 365 °C, SpO₂ 150) also block Next; unusual ones only warn.
  const stepTwoComplete = vitals.every((v) => !hasMeasurements(v) || (v.time !== "" && !hasVitalsErrors(v)));

  const stepThreeComplete = care.trim() !== "" && signature !== null;

  const submit = async () => {
    if (!signature || online === null) return;
    setBusy(true);
    try {
      const flow = getReportFlow(online);
      const recordedAt = new Date().toISOString();

      await flow.createPatient({
        patientId: patientId.current,
        eventId: duty.id,
        patientName: patient.patient_name,
        studentId: null,
        age: patient.patient_age,
        sex: patient.patient_sex,
        address: patient.patient_address,
        addedBy: userId,
        recordedAt,
      });
      await flow.createReport({
        patientReportId: reportId.current,
        patientId: patientId.current,
        chiefComplaint: patient.chief_complaint,
        careGiven: care,
        signatureDataUrl: signature,
        reportedBy: userId,
        recordedAt,
      });
      await flow.addVitals({
        patientReportId: reportId.current,
        eventId: duty.id,
        eventDate: duty.date,
        vitals: vitals.filter(hasMeasurements), // blank checks aren't saved
      });

      setSavedOffline(flow.mode === "offline");
      toast({ title: flow.mode === "online" ? "Report submitted" : "Report saved on this device" });
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
        <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight">
          {savedOffline ? "Report saved on this device" : "Report submitted"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {savedOffline ? "It will sync when you're back online. Returning…" : "Coming back to your home dashboard…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Report"
        description={`${duty.title} · ${duty.time ? fmtTime(duty.time) : fmtDate(duty.date)}`}
      />

      <div className="mb-5">
        <StepIndicator step={step} />
      </div>

      <SectionCard
        title={step === 1 ? "Patient & complaint" : step === 2 ? "Vitals (optional)" : "Care given & signature"}
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
