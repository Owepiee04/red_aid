# RedAid batch 2 — admin pages

Converted: AdminDashboard, AllReports, AdminReportDetail, CalendarManagement,
EventDetail, ManageAccounts, UserProfile → `src/app/admin/...` (App Router, typed).
All `base44.*` calls are gone; they now go through `src/lib/data/*` (Supabase).

## 1. Run the SQL
Paste `supabase/batch2-core-tables.sql` into the Supabase SQL editor (after batch 1's
profiles table). Then create your own account in Authentication -> Users and run the
commented "first admin" block at the bottom with your email.

## 2. Copy the files
Drop `src/` into your repo (it merges with batch 1). No new npm packages beyond batch 1.

## 3. These pages import components I haven't seen yet — they won't compile until you send them
PageHeader, StatCard, SectionCard, ReportList, reportColumns, LoadingState, EmptyState,
StatusBadge, UserAvatar, ReportReadOnly, CalendarMonth, EventCard, EventFormDialog,
AddAccountDialog, `lib/formatting`, `ui/{select,switch,textarea,use-toast}`.
Props the pages expect are in the notes message.

## What changed beyond a straight port
- **Data model:** Base44's embedded arrays (`team_leader_ids`, `charter_ids`,
  `verified_charter_ids`) became the `event_assignments` table with a `verified` flag.
- **Reports** come back with `charter_name`, `team_leader_name`, `reviewed_by_name`,
  `event_title`, `vitals_readings` flattened on, so your old column/detail components
  keep working. Dates are `created_at` (was `created_date`); photos are `photo_url` (was `photo_uri`).
- **Drafts are hidden from admins** by RLS (a charter's unfinished draft stays private).
- **Search** is debounced and sanitised; Mongo `$regex` became `ilike`.
- **Bug fix:** Report detail said "reviewed by <team_leader_name>" — now uses the actual
  reviewer (`reviewed_by`).
- **Errors:** failed saves show a toast instead of silently failing; failed loads show an
  empty state with the message; RLS-blocked updates are detected (0 rows) rather than
  reporting success.
- **Dashboard:** "Active Users" is now a count query instead of downloading every user.
- Dropped unused imports (e.g. `StatusBadge`/`PageHeader` in UserProfile).

## Security reminder
When you build Edit Profile, don't add a blanket "users can update own profile" policy —
that would let anyone make themselves admin. Restrict to name/photo only.

## Hydration
Wrap the admin pages in a layout that renders nothing until `isLoadingAuth` is false
(the shell file will do this) so `new Date()` doesn't cause a server/client mismatch.
