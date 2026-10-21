import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { ReportStatus, VitalsReading } from "@/types/domain";

// Needed so fmtTime can read "14:30" / "14:30:00" / "2:30 PM" strictly.
dayjs.extend(customParseFormat);

type DateInput = string | Date | null | undefined;

/** Today as YYYY-MM-DD in the browser's local time zone. */
export const todayISO = (): string => dayjs().format("YYYY-MM-DD");

/** Current time as HH:mm (24h) — the format <input type="time"> uses. */
export const nowTime = (): string => dayjs().format("HH:mm");

export function fmtDate(value: DateInput, format = "MMM D, YYYY"): string {
  if (!value) return "—";
  return dayjs(value).format(format);
}

/** Accepts Postgres `time` ("14:30:00"), "14:30", or "2:30 PM"; shows "2:30 PM". */
export function fmtTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = dayjs(value, ["HH:mm", "H:mm", "h:mm A", "HH:mm:ss"], true);
  return d.isValid() ? d.format("h:mm A") : value;
}

export function fmtDateLong(value: DateInput): string {
  return fmtDate(value, "dddd, MMMM D, YYYY");
}

export function fmtDateTimeStamp(value: DateInput): string {
  if (!value) return "—";
  return dayjs(value).format("MMM D, YYYY · h:mm A");
}

export function monthBounds(monthDate: Date | string): { start: string; end: string; label: string } {
  const d = dayjs(monthDate);
  return {
    start: d.startOf("month").format("YYYY-MM-DD"),
    end: d.endOf("month").format("YYYY-MM-DD"),
    label: d.format("MMMM YYYY"),
  };
}

export const REPORT_STATUS: Record<ReportStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  submitted: { label: "Submitted", className: "bg-amber-50 text-amber-700 border-amber-200" },
  reviewed: { label: "Reviewed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export type VerificationStatus = "verified" | "pending";

export const VERIFICATION_STATUS: Record<VerificationStatus, { label: string; className: string }> = {
  verified: { label: "Verified", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Pending", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

/** "120/80" from a saved vitals reading (database column names). */
export function bpOf(
  vital: Pick<VitalsReading, "bp_systolic" | "bp_diastolic"> | null | undefined
): string {
  if (!vital) return "—";
  const sys = vital.bp_systolic;
  const dia = vital.bp_diastolic;
  if (sys == null && dia == null) return "—";
  return `${sys ?? "—"}/${dia ?? "—"}`;
}

export function initialsOf(name: string | null | undefined): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
