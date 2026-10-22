# RedAid batch 7 — shared display components, Event form, Add Account

Converted: PageHeader, StatCard, SectionCard, ReportList, reportColumns, LoadingState,
UserAvatar, CalendarMonth, EventCard, EventFormDialog, AddAccountDialog.
(SectionCard and reportColumns each arrived twice in your paste — one converted copy each.)

## 1. Run the SQL
`supabase/batch7-events-avatars.sql`, after batches 2, 3 and 6. Adds `save_event()` and a
private `avatars` storage bucket.

## 2. Server key for creating accounts (IMPORTANT)
Creating a login needs Supabase's *service role* key. In `.env.local` add:

    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

Supabase -> Settings -> API -> "service_role" (NOT the anon key). Rules:
- Never put NEXT_PUBLIC_ in front of the name — that would publish it to every visitor.
- Never commit `.env.local`, never paste the key in chat/screenshots.
- On Vercel add it under Project Settings -> Environment Variables (without NEXT_PUBLIC_).
The key is only used in `src/app/api/admin/accounts/route.ts`, which first checks that the
caller is a logged-in admin.

## 3. Supabase redirect URLs
Authentication -> URL Configuration: set Site URL to your deployed address and add
`http://localhost:3000/**` and your Vercel address with `/**` to Redirect URLs. Without
this, invite and password-reset emails send people to the wrong page.

## 4. Copy files
All new, except these REPLACE earlier versions:
- `src/lib/data/events.ts` (adds saveEvent/deleteEvent; copy AFTER batch 6's)
- `src/lib/storage.ts` (adds getAvatarUrl; copy AFTER batch 3's)
- `src/app/admin/events/[id]/page.tsx` (after deleting an event it now returns to the calendar)
Also delete any older `src/components/reportColumns.ts` if you made one — it is `.tsx` now.

## 5. Still needed from you
- **PersonPicker** (src/components/PersonPicker.jsx) — EventFormDialog uses it. Its props are
  now `people` (profile rows: id, full_name, email, photo_url), `selectedIds`, `onToggle`,
  `placeholder`.
- **Layouts / route guards:** the admin, team-leader and charter shells (sidebar/nav/header),
  plus App.jsx so I can see which routes are protected. Nothing links the pages together
  or blocks the wrong role until these are done.
- **Toast files:** `use-toast`, `toast` and `toaster` (shadcn's current CLI no longer offers
  the old toast, so paste yours).
- **UI primitives:** dialog, alert-dialog, select, switch, textarea. These are standard
  shadcn — in your repo run:
      npx shadcn@latest add dialog alert-dialog select switch textarea
  (If your Tailwind tokens like bg-primary look wrong afterwards, tell me.)

## What changed beyond a straight port
- **Events + people save together** (`save_event`): Base44 stored a copy of each person's
  name/photo inside the event. Now assignments are real rows, so renaming someone updates
  everywhere. Editing keeps existing approvals; removing a charter removes their approval.
- **Deleting events:** an event that already has patient reports can't be deleted (records
  are protected); you get a clear message instead of a silent failure.
- **Deactivated accounts** no longer show up in the pickers (unless already on the event).
- **Create account** — big change: Base44's `inviteUser` became a secure server route
  (see section 2) that creates the login AND the profile in one go, and undoes the login if
  the profile can't be saved. NEW optional "Temporary password" field: Supabase's built-in
  email sending allows only a few emails per hour, so inviting ~30 members by email can
  stall. With a temporary password no email is sent; hand it over in person.
  (Or set up custom SMTP in Supabase later.)
- **Avatars:** profile photos are fetched as signed links and remembered in memory, so a
  long account list isn't dozens of requests every time.
- `moment` -> `dayjs` in CalendarMonth; "created_date" -> "created_at" in report columns.
- `StatCard` / `EventCard` no longer use a dynamic tag name (cleaner types, no stray `type`
  attribute on a div).

## Tested
- SQL: all four files loaded on a local Postgres; 20 checks on save_event and avatars passed
  (create, edit keeps approvals, role change, removal, non-admins blocked, deleting an event
  with reports is refused).
- TypeScript compiles with the dialogs/PersonPicker stubbed.
- NOT tested: the account-creation route against a real Supabase project (it needs your
  keys). Try adding one test account right after setup and tell me what you see.
