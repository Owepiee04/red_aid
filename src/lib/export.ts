import type { Worksheet } from "exceljs";
import { fmtDate, fmtTime } from "@/lib/formatting";
import type { EventDetail, Report } from "@/types/domain";

/**
 * Builds the Excel file for one event and starts the download in the browser.
 * Three sheets:
 *   Summary - the event, who was on duty, and when it was exported
 *   Reports - one row per patient report with every field from the form
 *   Vitals  - one row per vitals check, linked to its report by "No."
 * exceljs is loaded only when someone exports, so it doesn't slow down normal pages.
 */

const STAMP = "YYYY-MM-DD h:mm A"; // sortable, and reads well in Excel

const text = (value: string | null | undefined) => value?.trim() || "";
const stamp = (value: string | null | undefined) => (value ? fmtDate(value, STAMP) : "");
const STATUS_LABEL: Record<Report["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

/** "Intramurals Day 1" + 2026-10-21 -> "RedAid_Intramurals-Day-1_2026-10-21.xlsx" */
export function exportFileName(event: Pick<EventDetail, "title" | "date">): string {
  const slug =
    event.title
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "Event";
  return `RedAid_${slug}_${event.date}.xlsx`;
}

export async function downloadEventWorkbook(
  event: EventDetail,
  reports: Report[],
  exportedBy: string | null | undefined
): Promise<void> {
  // exceljs is a CommonJS package: depending on the bundler, its classes are on the
  // module itself or on `.default`.
  const excel = await import("exceljs");
  const Workbook = excel.Workbook ?? (excel as unknown as { default: typeof excel }).default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "RedAid";
  workbook.created = new Date();

  const headerStyle = (sheet: Worksheet) => {
    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle", wrapText: true };
  };

  // ---------------------------------------------------------------- Summary
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Field", key: "field", width: 22 },
    { header: "Value", key: "value", width: 60 },
  ];
  const names = (people: EventDetail["charters"]) =>
    people.map((p) => p.name || "Unnamed").join(", ") || "None";
  summary.addRows([
    { field: "Event", value: event.title },
    { field: "Date", value: fmtDate(event.date, "dddd, MMMM D, YYYY") },
    { field: "Time", value: event.time ? fmtTime(event.time) : "" },
    { field: "Location", value: text(event.location) },
    { field: "Description", value: text(event.description) },
    { field: "Team Leader(s)", value: names(event.team_leaders) },
    { field: "Charters", value: names(event.charters) },
    { field: "Duty ended", value: event.ended_at ? stamp(event.ended_at) : "Not ended" },
    { field: "Patient reports", value: String(reports.length) },
    {
      field: "Vitals checks",
      value: String(reports.reduce((n, r) => n + r.vitals_readings.length, 0)),
    },
    { field: "Exported", value: fmtDate(new Date(), STAMP) },
    { field: "Exported by", value: text(exportedBy) },
  ]);
  headerStyle(summary);
  summary.getColumn("field").font = { bold: true };

  // ---------------------------------------------------------------- Reports
  const reportSheet = workbook.addWorksheet("Reports", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  reportSheet.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Patient Name", key: "patient_name", width: 24 },
    { header: "Age", key: "age", width: 6 },
    { header: "Sex", key: "sex", width: 6 },
    { header: "Address", key: "address", width: 30 },
    { header: "Chief Complaint", key: "chief_complaint", width: 30 },
    { header: "Care Given", key: "care_given", width: 40 },
    { header: "Vitals Checks", key: "vitals_count", width: 8 },
    { header: "Charter", key: "charter_name", width: 22 },
    { header: "Team Leader", key: "team_leader_name", width: 22 },
    { header: "Status", key: "status", width: 11 },
    { header: "Submitted At", key: "submitted_at", width: 20 },
    { header: "Reviewed By", key: "reviewed_by_name", width: 22 },
    { header: "Reviewed At", key: "reviewed_at", width: 20 },
    { header: "Review Notes", key: "review_notes", width: 30 },
    { header: "Admin Notes", key: "admin_notes", width: 30 },
    { header: "Event", key: "event_title", width: 24 },
    { header: "Event Date", key: "event_date", width: 12 },
    { header: "Location", key: "event_location", width: 20 },
    { header: "Report ID", key: "id", width: 38 },
  ];
  reports.forEach((r, i) => {
    reportSheet.addRow({
      no: i + 1,
      patient_name: text(r.patient_name),
      age: r.age, // a real number in Excel; 0 (infant) stays 0
      sex: text(r.sex),
      address: text(r.address),
      chief_complaint: text(r.chief_complaint),
      care_given: text(r.care_given),
      vitals_count: r.vitals_readings.length,
      charter_name: text(r.charter_name),
      team_leader_name: text(r.team_leader_name),
      status: STATUS_LABEL[r.status],
      submitted_at: stamp(r.submitted_at ?? r.created_at),
      reviewed_by_name: text(r.reviewed_by_name),
      reviewed_at: stamp(r.reviewed_at),
      review_notes: text(r.review_notes),
      admin_notes: text(r.admin_notes),
      event_title: text(r.event_title),
      event_date: text(r.event_date),
      event_location: text(r.event_location),
      id: r.id,
    });
  });
  headerStyle(reportSheet);
  reportSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: reportSheet.columnCount } };
  for (const key of ["address", "chief_complaint", "care_given", "review_notes", "admin_notes"]) {
    reportSheet.getColumn(key).alignment = { vertical: "top", wrapText: true };
  }

  // ---------------------------------------------------------------- Vitals
  const vitalsSheet = workbook.addWorksheet("Vitals", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  vitalsSheet.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Patient Name", key: "patient_name", width: 24 },
    { header: "Check", key: "check", width: 7 },
    { header: "Time Taken", key: "time_taken", width: 20 },
    { header: "Temp (°C)", key: "temp", width: 10 },
    { header: "PR (bpm)", key: "pr", width: 10 },
    { header: "RR (/min)", key: "rr", width: 10 },
    { header: "BP Systolic (mmHg)", key: "bp_systolic", width: 12 },
    { header: "BP Diastolic (mmHg)", key: "bp_diastolic", width: 12 },
    { header: "SpO₂ (%)", key: "spo2", width: 10 },
    { header: "Report ID", key: "report_id", width: 38 },
  ];
  reports.forEach((r, i) => {
    r.vitals_readings.forEach((v, j) => {
      vitalsSheet.addRow({
        no: i + 1,
        patient_name: text(r.patient_name),
        check: j + 1,
        time_taken: stamp(v.time_taken),
        // numbers stay numbers (blank when not taken), so Excel can average them
        temp: v.temp === null ? null : Number(v.temp),
        pr: v.pr,
        rr: v.rr,
        bp_systolic: v.bp_systolic,
        bp_diastolic: v.bp_diastolic,
        spo2: v.spo2,
        report_id: r.id,
      });
    });
  });
  headerStyle(vitalsSheet);
  vitalsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: vitalsSheet.columnCount } };

  // ---------------------------------------------------------------- download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(event);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
