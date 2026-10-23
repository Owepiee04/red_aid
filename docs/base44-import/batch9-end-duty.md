# RedAid batch 9 — "End duty" feature

A Team Leader (or Admin) can end an event. Charters then automatically lose the ability to
chart — after a 30-minute grace period — and the duty can be reopened.

## How it works (the short version)
- Events get an `ended_at` mark (empty = still open).
- The database's charting rule now also checks "not ended more than 30 minutes ago".
  Nothing is rewritten for each charter: approvals are KEPT, so reopening a duty restores
  everyone who was approved. (If you ended by mistake, one tap fixes it.)
- Only a Team Leader of that event, or an Admin, can end/reopen it. Charters can't, and a
  Team Leader of a different event can't.
- While a duty is ended, the Team Leader can't approve more charters (they must reopen it
  first); revoking still works.
- Can't end an event that hasn't started (future date).

## 1. Run the SQL
`supabase/batch9-end-duty.sql` in the Supabase SQL editor, AFTER batches 2, 3, 6 and 7.
It adds two columns and replaces two earlier functions (`can_chart_for_event`,
`set_charter_verified`) — that is expected.

## 2. Copy files (batch 9 AFTER all earlier batches — several files are updated)
NEW:
- `src/components/EndDutyControl.tsx` (End Duty / Reopen Duty button with a confirm dialog)
- `src/lib/duty.ts` (grace-period rule used by the screens)
UPDATED (overwrite):
- `src/types/domain.ts`, `src/lib/data/events.ts`, `src/lib/data/reports.ts`
- `src/app/charter/page.tsx` — new "Duty ended" banner; "charting closes at 3:30 PM" note
  during the grace period
- `src/app/charter/report/new/page.tsx` — blocks the form once charting is closed
- `src/app/team-leader/page.tsx` — End Duty button + "Duty ended at …" notice
- `src/app/team-leader/verify/page.tsx` — End Duty button; Approve disabled while ended
- `src/app/admin/events/[id]/page.tsx` — End/Reopen button + "Duty status" row

No new npm packages.

## Things to know
- **The 30 minutes is in two places:** `supabase/batch9-end-duty.sql` (the real rule) and
  `CHARTING_GRACE_MINUTES` in `src/lib/duty.ts` (what the screens say). Change both together.
- **During the grace period a charter can start a NEW report too**, not just finish one in
  progress — the database can't tell them apart. The Charter home screen shows when
  charting closes so nobody is surprised.
- A charter in the middle of the form when the grace period runs out gets a clear error on
  submit; the form text is not saved anywhere (a saved draft is a good future addition).
- The screens use the browser's clock to decide what to show; the database uses its own clock
  for the real decision, so a phone with a wrong clock may show a slightly wrong message but
  can never bypass the rule.

## Tested
- SQL: 27 checks on a local Postgres, all passing — ending works only for the right people,
  not twice, not for future events; a charter can still submit right after it's ended but is
  blocked after 31 minutes; approving is blocked while ended; reopen restores charting;
  Admin can end/reopen; nobody can write `ended_at` directly.
- TypeScript compiles; the grace-period helper has 8 passing checks.
- Not tested in a browser or against a real Supabase project.
