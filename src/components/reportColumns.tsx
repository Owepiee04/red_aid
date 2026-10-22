import StatusBadge from "@/components/StatusBadge";
import type { ReportColumn } from "@/components/ReportList";
import { fmtDate } from "@/lib/formatting";
import type { Report } from "@/types/domain";

const patient = (row: Report) => <span className="font-medium">{row.patient_name || "—"}</span>;
const statusBadge = (row: Report) => <StatusBadge status={row.status} />;

export const adminReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "event_title", label: "Event" },
  { key: "charter_name", label: "Charter" },
  { key: "team_leader_name", label: "Team Leader" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "created_at", label: "Date Submitted", render: (row) => fmtDate(row.created_at) },
];

export const dashboardReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "event_title", label: "Event" },
  { key: "charter_name", label: "Charter" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "created_at", label: "Date", render: (row) => fmtDate(row.created_at, "MMM D") },
];

export const dutyReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "charter_name", label: "Charter" },
  { key: "event_title", label: "Event" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "created_at", label: "Time", render: (row) => fmtDate(row.created_at, "MMM D, h:mm A") },
];
