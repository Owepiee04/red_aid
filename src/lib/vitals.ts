// Rules for the numbers on a patient care report: what can be typed into each
// box, and which values are impossible (blocked) or unusual (warned about).
//
// Impossible values are blocked because they can only be typos (e.g. 365 °C
// instead of 36.5, SpO₂ 150). Unusual values only show a warning, because real
// emergencies do produce extreme vitals and the first aider must still be able
// to record them.

import type { VitalFormRow } from "@/lib/data/reports";

export type VitalField = "temp" | "pr" | "rr" | "bp_sys" | "bp_dia" | "spo2";

interface Rule {
  label: string;
  unit: string;
  /** Allows one decimal place (temperature) instead of whole numbers only. */
  decimal?: boolean;
  /** Most digits before the decimal point. */
  maxDigits: number;
  /** Outside this range the value is impossible and the step can't continue. */
  hard: [number, number];
  /** Outside this range the value is unusual: shown as a warning, still allowed. */
  soft: [number, number];
}

export const VITAL_RULES: Record<VitalField, Rule> = {
  temp: { label: "Temperature", unit: "°C", decimal: true, maxDigits: 3, hard: [25, 45], soft: [35, 39.5] },
  pr: { label: "Pulse rate", unit: "bpm", maxDigits: 3, hard: [0, 300], soft: [50, 130] },
  rr: { label: "Respiratory rate", unit: "/min", maxDigits: 3, hard: [0, 100], soft: [10, 30] },
  bp_sys: { label: "Systolic BP", unit: "mmHg", maxDigits: 3, hard: [0, 300], soft: [90, 180] },
  bp_dia: { label: "Diastolic BP", unit: "mmHg", maxDigits: 3, hard: [0, 200], soft: [50, 110] },
  spo2: { label: "SpO₂", unit: "%", maxDigits: 3, hard: [0, 100], soft: [94, 100] },
};

export const AGE_MAX = 130;

/**
 * Keeps only what a number box should hold: digits, plus (for decimals) one
 * point and one digit after it. A comma counts as a decimal point, since some
 * phone keypads only show a comma.
 */
export function cleanNumberInput(raw: string, opts: { decimal?: boolean; maxDigits: number }): string {
  if (!opts.decimal) return raw.replace(/\D/g, "").slice(0, opts.maxDigits);
  const text = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = text.indexOf(".");
  if (dot === -1) return text.slice(0, opts.maxDigits);
  const whole = text.slice(0, dot).slice(0, opts.maxDigits);
  const fraction = text.slice(dot + 1).replace(/\./g, "").slice(0, 1);
  return `${whole}.${fraction}`;
}

export interface FieldCheck {
  /** Blocks continuing: the value can't be right. */
  error?: string;
  /** Allowed, but worth double-checking. */
  warning?: string;
}

const fmt = (n: number) => String(n);

/** Checks one vitals box. Empty boxes are fine (vitals are optional). */
export function checkVital(field: VitalField, value: string): FieldCheck {
  const text = value.trim();
  if (text === "") return {};
  const rule = VITAL_RULES[field];
  if (text.endsWith(".")) return { error: "Finish the number (e.g. 36.5)." };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: "Numbers only." };
  const [min, max] = rule.hard;
  if (n < min || n > max) {
    if (field === "temp" && n > 90 && n < 115) return { error: "Looks like °F. Enter °C (e.g. 37.0)." };
    return { error: `Must be ${fmt(min)}–${fmt(max)}${rule.unit === "%" ? "" : " "}${rule.unit}.` };
  }
  const [low, high] = rule.soft;
  if (n < low) return { warning: `Low. Please double-check.` };
  if (n > high) return { warning: `High. Please double-check.` };
  return {};
}

/** All problems in one vitals check, by field, including diastolic ≥ systolic. */
export function checkVitalsRow(row: VitalFormRow): Partial<Record<VitalField, FieldCheck>> {
  const result: Partial<Record<VitalField, FieldCheck>> = {};
  (Object.keys(VITAL_RULES) as VitalField[]).forEach((field) => {
    const check = checkVital(field, row[field]);
    if (check.error || check.warning) result[field] = check;
  });
  const sys = Number(row.bp_sys);
  const dia = Number(row.bp_dia);
  if (row.bp_sys.trim() && row.bp_dia.trim() && !result.bp_dia?.error && !result.bp_sys?.error && dia >= sys && sys > 0) {
    result.bp_dia = { error: "Must be lower than systolic." };
  }
  return result;
}

/** True when a vitals check has a value that blocks continuing. */
export function hasVitalsErrors(row: VitalFormRow): boolean {
  return Object.values(checkVitalsRow(row)).some((check) => !!check?.error);
}

/** Checks the patient's age box. */
export function checkAge(value: string): FieldCheck {
  const text = value.trim();
  if (text === "") return {};
  const n = Number(text);
  if (!Number.isInteger(n)) return { error: "Whole years only." };
  if (n > AGE_MAX) return { error: `Must be 0–${AGE_MAX}.` };
  return {};
}
