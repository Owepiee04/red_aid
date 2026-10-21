import { bpOf, fmtDate } from "@/lib/formatting";
import type { VitalsReading } from "@/types/domain";

const COLUMNS = [
  { key: "time", label: "Time" },
  { key: "temp", label: "Temp (°C)" },
  { key: "pr", label: "PR (bpm)" },
  { key: "rr", label: "RR (/min)" },
  { key: "bp", label: "BP (mmHg)" },
  { key: "spo2", label: "SpO₂ (%)" },
] as const;

// `?? "—"` rather than `|| "—"` so a real reading of 0 still shows.
const show = (value: number | null | undefined) => value ?? "—";

export default function VitalsTable({ vitals = [] }: { vitals?: VitalsReading[] }) {
  if (!vitals.length) {
    return <p className="text-sm text-muted-foreground">No vitals recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {COLUMNS.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-3 py-2.5 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vitals.map((vital) => (
            <tr key={vital.id} className="border-t border-border/70">
              <td className="px-3 py-2.5 font-medium">{fmtDate(vital.time_taken, "h:mm A")}</td>
              <td className="px-3 py-2.5">{show(vital.temp)}</td>
              <td className="px-3 py-2.5">{show(vital.pr)}</td>
              <td className="px-3 py-2.5">{show(vital.rr)}</td>
              <td className="px-3 py-2.5">{bpOf(vital)}</td>
              <td className="px-3 py-2.5">{show(vital.spo2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
