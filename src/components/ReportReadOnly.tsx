import { Clock } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import VitalsTable from "@/components/VitalsTable";
import SignatureImage from "@/components/SignatureImage";
import { fmtDate, submittedStamp } from "@/lib/formatting";
import type { Report } from "@/types/domain";

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  // Not `value || "—"`: an infant's age of 0 is real data and must still show.
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{empty ? "—" : value}</p>
    </div>
  );
}

/** The patient care report exactly as charted — read only for every role. */
export default function ReportReadOnly({ report }: { report: Report | null | undefined }) {
  if (!report) return null;
  const submitted = submittedStamp(report);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Event</p>
            <h2 className="font-heading text-xl font-bold tracking-tight">{report.event_title || "—"}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {fmtDate(report.event_date)}
            {report.event_location ? ` · ${report.event_location}` : ""}
          </p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {submitted ? `Submitted ${submitted}` : "Draft · not submitted yet"}
        </p>
        <div className="mt-4 border-t border-border/70 pt-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Chief complaint</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{report.chief_complaint || "—"}</p>
        </div>
      </section>

      <SectionCard title="Patient information">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="col-span-2">
            <InfoRow label="Name" value={report.patient_name} />
          </div>
          <InfoRow label="Age" value={report.age} />
          <InfoRow label="Sex" value={report.sex} />
          <div className="col-span-2 sm:col-span-4">
            <InfoRow label="Address" value={report.address} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Vitals" contentClassName="px-3 pb-3 pt-1">
        <VitalsTable vitals={report.vitals_readings} />
      </SectionCard>

      <SectionCard title="Care given">
        <p className="whitespace-pre-wrap text-sm">{report.care_given || "—"}</p>
      </SectionCard>

      <SectionCard title="Signature">
        <SignatureImage path={report.signature_url} />
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">First aider:</span>{" "}
          <span className="font-medium">{report.charter_name || "—"}</span>
        </p>
      </SectionCard>
    </div>
  );
}
