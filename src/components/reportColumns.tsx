import StatusBadge from "@/components/StatusBadge";
import type { ReportColumn } from "@/components/ReportList";
import { submittedStamp } from "@/lib/formatting";
import type { Report } from "@/types/domain";

const patient = (row: Report) => <span className="font-medium">{row.patient_name || "—"}</span>;
const statusBadge = (row: Report) => <StatusBadge status={row.status} />;

export const adminReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "event_title", label: "Event" },
  { key: "charter_name", label: "Charter" },
  { key: "team_leader_name", label: "Team Leader" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "submitted_at", label: "Submitted", render: (row) => submittedStamp(row) ?? "—" },
];

export const dashboardReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "event_title", label: "Event" },
  { key: "charter_name", label: "Charter" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "submitted_at", label: "Submitted", render: (row) => submittedStamp(row, "MMM D, h:mm A") ?? "—" },
];

export const dutyReportColumns = (): ReportColumn[] => [
  { key: "patient_name", label: "Patient Name", render: patient },
  { key: "charter_name", label: "Charter" },
  { key: "event_title", label: "Event" },
  { key: "status", label: "Status", render: statusBadge },
  { key: "submitted_at", label: "Submitted", render: (row) => submittedStamp(row, "MMM D, h:mm A") ?? "—" },
];
