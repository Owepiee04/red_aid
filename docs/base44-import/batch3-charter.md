# RedAid batch 3 — Charter pages

Converted: CharterHome, CharterCalendar, MyReports, NewReport, ReportView →
`src/app/charter/...` (routes: /charter, /charter/calendar, /charter/reports,
/charter/reports/[id], /charter/report/new).

## 1. Run the SQL
`supabase/batch3-charter-policies.sql` in the Supabase SQL editor, after batch 2's.
It adds: charter permissions, the verification gate (in the database), a
`submit_report()` function, and a private `signatures` storage bucket.

## 2. Copy files — three files REPLACE batch 2 versions
`src/types/domain.ts`, `src/lib/data/reports.ts`, `src/lib/data/events.ts` are updated
(new fields/functions added; nothing removed). Overwrite them. New: `src/lib/storage.ts`,
`src/types/report-form.ts`.

## 3. Still needed from you (not seen yet)
ReportCardList, report/StepIndicator, StepPatient, StepVitals (incl. `emptyVital`),
StepCare (signature pad), `lib/formatting` (incl. `fmtDateTimeStamp`).
StepVitals/StepPatient should use the `VitalForm` / `PatientForm` types from
`src/types/report-form.ts`. `lib/files` is no longer needed by NewReport.
`EventCard`'s `onClick` must be optional (Home uses it without one).

## What changed beyond a straight port
- **Verification gate is enforced by the database**, not just the page: the insert policy
  only allows a charter who is verified for an event happening TODAY (Philippine time).
- **Report + vitals save in one transaction** (`submit_report`). Base44 stored vitals as an
  embedded array; now each reading is a row in `vitals_readings`.
- **Retry-safe:** the report id is generated once per form; signature upload and submit are
  idempotent, so tapping Submit again can't create duplicates.
- **Signatures** go to a private Supabase bucket (`<user id>/<report id>.png`); the report
  stores the path. To DISPLAY one, ReportReadOnly must call `getSignatureUrl(path)`
  from `src/lib/storage.ts` (signed link).
- Field renames: patient_age/sex/address -> age/sex/address; signature_uri -> signature_url;
  reviewed_date -> reviewed_at; denormalised names (charter_name, event_title, ...) are
  now joined and flattened onto the report, so ReportReadOnly can keep reading them.
  `event_date` and `event_location` were added for the same reason.
- Home and New Report now agree if someone has two events today (a verified one wins).
- Errors show a toast (failed submit, failed upload, no approval) instead of silently failing.
- Redirect when not approved uses `router.replace` (can't be bounced back to with Back).

## Assumptions to check
- StepVitals' `time` is "HH:MM" text; it is combined with the event date.
- Sex is only "M" or "F" (as on the paper form). Tell me if StepPatient allows more.
- Philippine time (Asia/Manila) is hard-coded in the SQL gate.
