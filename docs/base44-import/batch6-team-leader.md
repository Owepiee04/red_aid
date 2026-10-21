# RedAid batch 6 — Team Leader pages

Converted: TeamLeaderDashboard, DutyCalendar, DutyReports, ReportReview, VerifyCharters →
`src/app/team-leader/...` (routes: /team-leader, /team-leader/calendar, /team-leader/reports,
/team-leader/reports/[id], /team-leader/verify — these match the paths already in roles.ts).

## 1. Run the SQL
`supabase/batch6-teamleader-policies.sql` in the Supabase SQL editor, after batches 2 and 3.

## 2. Copy files — two files REPLACE earlier versions
`src/lib/data/reports.ts` and `src/lib/data/events.ts` gain new functions/parameters
(nothing removed). Copy this batch AFTER batches 2–5 so these two overwrite the older ones.

## 3. Component changes needed (files I haven't converted yet)
- **SectionCard** must accept an optional `action` (a button shown in the header) —
  the dashboard uses it — and `title` must be optional (VerifyCharters has none).
- **reportColumns** must export `dutyReportColumns()` alongside the admin/dashboard ones.
- **UserAvatar** `uri` should accept `null`.
- **EventCard** `onClick` optional (already noted in batch 3).

## What changed beyond a straight port
- **Approving charters and reviewing reports are now protected in the database.**
  In Base44 any logged-in user could edit an event's `verified_charter_ids`. Now:
  - `set_charter_verified()`: only a Team Leader on THAT event, only for events today or
    later, only for charters actually assigned. Records who approved and when.
  - `review_report()`: only a Team Leader on that report's event, only for submitted
    reports, only once. Reviewer and review time are written by the database (the page no
    longer sends `reviewed_by_name` / `reviewed_date`).
  - Team Leaders cannot edit patient data or reassign people.
- **Co-leaders:** Duty Reports now shows reports from every event you lead, not just those
  where you were saved as "the" team leader, so a second Team Leader isn't left out.
- **Dashboard:** fetches the full event so it can list charters and their approval status;
  the report count counts submitted/reviewed reports only.
- **Verify page:** wrong/pasted event ids show "Not your duty"; past duties show a notice
  and disable Approve/Revoke; errors show a toast. `useSearchParams` is wrapped in
  `<Suspense>` (Next.js fails the production build otherwise).
- Team Leaders can now see signatures for reports on their duties (storage policy added).

## Tested
I ran all three SQL files (batches 2, 3, 6) on a local Postgres and checked 32 scenarios:
an unverified charter is blocked; approval unlocks charting and revoking blocks it again;
future and past events can't be charted; a retried submit makes no duplicate; charters can't
see others' reports; Team Leaders can't edit reports directly; nobody can make themselves
admin or self-verify; double reviews are refused. Supabase's own auth/storage were
stand-ins there, so the signature-storage policies compile but weren't exercised — check
that once with a real signature after you deploy.
