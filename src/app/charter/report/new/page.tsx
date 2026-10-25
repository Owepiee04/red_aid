"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudOff, History } from "lucide-react";
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
import { isChartingOpen } from "@/lib/duty";
import {
  clearDraft,
  loadDraft,
  loadTodaysDuty,
  saveDraft,
  submitOrQueue,
  type ReportDraft,
  type SubmitOutcome,
} from "@/lib/offline";
import type { PatientForm, VitalForm } from "@/types/report-form";

const emptyPatient = (): PatientForm => ({
  chief_complaint: "",
  patient_name: "",
  patient_age: "",
  patient_sex: "M",
  patient_address: "",
});

export default function NewReportPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<SubmitOutcome | null>(null);

  const [patient, setPatient] = useState<PatientForm>(emptyPatient);
  const [vitals, setVitals] = useState<VitalForm[]>(() => [emptyVital()]);
  const [care, setCare] = useState("");
  const [signature, setSignature] = useState<string | null>(null);

  // Created once per form, so pressing Submit again after a network hiccup
  // can't produce two copies of the same report.
  const reportId = useRef<string>("");
  if (!reportId.current) reportId.current = crypto.randomUUID();

  // Only a duty the charter is verified for — and that hasn't been ended — lets them chart.
  // Offline mode: with no signal, this is the last duty seen online.
  const { data: duty, loading } = useData(async () => {
    if (!userId) return null;
    const { duty: event } = await loadTodaysDuty(userId, todayISO());
    return event && isChartingOpen(event) ? event : null;
  }, [userId]);

  const redirected = useRef(false);
  useEffect(() => {
    if (loading || duty || redirected.current) return;
    redirected.current = true;
    toast({ title: "Charting isn't open — you need Team Leader approval for a duty that hasn't ended." });
    router.replace("/charter");
  }, [loading, duty, toast, router]);

  // --- Offline mode: bring back a half-finished form, and keep saving it -----
  const [restored, setRestored] = useState<ReportDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!userId || !duty || draftReady) return;
    let cancelled = false;
    loadDraft(userId, duty.id).then((draft) => {
      if (cancelled) return;
      if (draft) {
        reportId.current = draft.reportId;
        setPatient(draft.patient);
        setVitals(draft.vitals.length ? draft.vitals : [emptyVital()]);
        setCare(draft.care);
        setStep(draft.step);
        setRestored(draft);
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, duty, draftReady]);

  const pristine =
    JSON.stringify(patient) === JSON.stringify(emptyPatient()) &&
    care.trim() === "" &&
    vitals.every((v) => !hasMeasurements(v));

  useEffect(() => {
    if (!draftReady || !userId || !duty || submitted || pristine) return;
    const timer = setTimeout(() => {
      void saveDraft({ userId, eventId: duty.id, reportId: reportId.current, step, patient, vitals, care });
    }, 400);
    return () => clearTimeout(timer);
  }, [draftReady, userId, duty, submitted, pristine, step, patient, vitals, care]);

  const startOver = () => {
    if (userId) void clearDraft(userId);
    reportId.current = crypto.randomUUID();
    setPatient(emptyPatient());
    setVitals([emptyVital()]);
    setCare("");
    setSignature(null);
    setStep(1);
    setRestored(null);
  };
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.push("/charter"), submitted === "queued" ? 3500 : 1500);
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
    if (!signature) return;
    setBusy(true);
    try {
      // Offline mode: saved on the phone first, then sent. With no signal it
      // stays saved ("queued") and sends automatically later.
      const outcome = await submitOrQueue({
        userId,
        eventTitle: duty.title,
        signature,
        input: {
          id: reportId.current,
          eventId: duty.id,
          eventDate: duty.date,
          ...patient,
          vitals: vitals.filter(hasMeasurements), // blank checks aren't saved
          care_given: care,
        },
      });
      await clearDraft(userId);
      toast({ title: outcome === "sent" ? "Report submitted" : "Saved on this phone — it will send when you have signal" });
      setSubmitted(outcome);
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
    const queued = submitted === "queued";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            queued ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {queued ? <CloudOff className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight">
          {queued ? "Saved on this phone" : "Report submitted"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {queued
            ? "There's no signal, so the report will send automatically when you're back online. You'll see it under “Waiting to send” on Home until then."
            : "Coming back to your home dashboard…"}
        </p>
        {queued && (
          <Button className="mt-6" variant="outline" onClick={() => router.push("/charter")}>
            Back to Home
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="New Report" description={`${duty.title} · ${fmtTime(duty.time)}`} />

      {restored && (
        <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 leading-snug">
            <strong className="font-semibold">We brought back the report you were filling in</strong> (last change{" "}
            {fmtDate(restored.savedAt, "h:mm A")}). Check it, and sign again on the last step.
          </p>
          <button type="button" onClick={startOver} className="font-semibold underline underline-offset-2">
            Start over
          </button>
        </div>
      )}

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
