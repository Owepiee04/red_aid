import { AGE_MAX, VITAL_RULES, checkVitalsRow, type VitalField } from "@/lib/vitals";
import type { VitalFormRow } from "./types";

export interface ParsedVital {
  created_at: string;
  temperature: number | null;
  pulse_rate_per_minute: number | null;
  respiration_rate_per_minute: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  oxygen_level: number | null;
}

export function parseAge(value: string): number {
  const age = parseNumber(value, "Age", { int: true });
  if (age === null) throw new Error("Age is required.");
  if (age < 0 || age > AGE_MAX) throw new Error(`Age must be 0–${AGE_MAX}.`);
  return age;
}

function parseNumber(value: string, label: string, opts: { int?: boolean } = {}): number | null {
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || (opts.int && !Number.isInteger(n))) {
    throw new Error(`${label} must be a ${opts.int ? "whole " : ""}number (you entered "${value}").`);
  }
  return n;
}

export function parseVitalRows(eventDate: string, rows: VitalFormRow[]): ParsedVital[] {
  return rows.map((v, i) => {
    const where = `Vitals check ${i + 1}`;
    const problem = Object.entries(checkVitalsRow(v)).find(([, check]) => check?.error);
    if (problem) {
      const [field, check] = problem;
      throw new Error(`${where} ${VITAL_RULES[field as VitalField].label.toLowerCase()}: ${check?.error}`);
    }
    const taken = new Date(`${eventDate}T${v.time}`);
    if (Number.isNaN(taken.getTime())) throw new Error(`${where}: the time isn't valid.`);
    return {
      created_at: taken.toISOString(),
      temperature: parseNumber(v.temp, `${where} temperature`),
      pulse_rate_per_minute: parseNumber(v.pr, `${where} pulse rate`, { int: true }),
      respiration_rate_per_minute: parseNumber(v.rr, `${where} respiratory rate`, { int: true }),
      blood_pressure_systolic: parseNumber(v.bp_sys, `${where} systolic BP`, { int: true }),
      blood_pressure_diastolic: parseNumber(v.bp_dia, `${where} diastolic BP`, { int: true }),
      oxygen_level: parseNumber(v.spo2, `${where} SpO₂`, { int: true }),
    };
  });
}
