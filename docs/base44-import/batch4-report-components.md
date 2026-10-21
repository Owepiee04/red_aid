# RedAid batch 4 — report components + formatting

Converted: ReportCardList, report/StepIndicator, StepPatient, StepVitals (+ emptyVital),
StepCare, and lib/formatting. Goes with batches 2–3 (the charter pages use these).

## 1. Install
    npm install dayjs
(`moment` was replaced by `dayjs` — same format strings like "MMM D, YYYY", much smaller,
and moment is no longer maintained. You don't need to install moment.)

## 2. Copy files
- NEW: `src/lib/formatting.ts`, `src/components/ReportCardList.tsx`,
  `src/components/report/{StepIndicator,StepPatient,StepVitals,StepCare}.tsx`
- REPLACES batch 3's `src/lib/data/reports.ts` (vitals/age parsing fix, see below).

## 3. Still needed
- `SignaturePad` (src/components/SignaturePad.jsx) — StepCare imports it. It must call
  `onChange(dataUrl | null)` with a PNG data URL, or null when cleared. If yours does
  something different, I'll adapt it when you send it.
- StatusBadge, EmptyState, ReportReadOnly (still outstanding from before).

## What changed beyond a straight port
- ReportCardList reads `created_at` (was `created_date`); a missing handler no longer
  needs the `onOpen && onOpen(...)` pattern.
- `bpOf` now reads `bp_systolic` / `bp_diastolic` (the database names) instead of the form's
  `bp_sys` / `bp_dia`. The form keeps its own names; only saved readings use the new ones.
- Vitals fields get number keypads on phones (`inputMode`), and Age is limited to whole
  numbers 0–130.
- **Bug prevented:** the vitals boxes are plain text, so "36,5" or "abc" used to be quietly
  saved as blank and a decimal age would have crashed the save. Submit now accepts a decimal
  comma and otherwise stops with a message naming the field ("Vitals check 2 pulse rate
  must be a whole number").
- Confirmed from your code: time is "HH:mm" and sex is "M"/"F" — both assumptions from
  batch 3 were right.
