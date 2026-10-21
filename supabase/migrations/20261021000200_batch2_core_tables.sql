-- RedAid batch 2: events, assignments, reports, vitals + admin-side RLS.
-- Run once in the Supabase SQL editor, AFTER the profiles table from batch 1.
-- Re-running will error on "already exists" — that's expected.

-- ---------------------------------------------------------------------------
-- 1. profiles: two columns the admin pages need
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists active boolean not null default true,
  add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- "Is the signed-in user an admin?" Policies on `profiles` can't query
-- `profiles` directly (infinite recursion), so this runs as SECURITY DEFINER
-- and every admin policy below calls it instead.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time time,
  location text,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_date_idx on public.events (date);
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Who is on duty for an event. Replaces Base44's embedded team_leader_ids /
-- charter_ids / verified_charter_ids arrays. `verified` is the Team Leader's
-- approval: a charter with verified = false cannot chart for that event.
create table public.event_assignments (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  duty_role text not null check (duty_role in ('team_leader', 'charter')),
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  check (duty_role = 'charter' or verified = false)
);
create index event_assignments_user_idx on public.event_assignments (user_id);

-- One row per patient. The id has a default but the app may supply its own
-- (offline-created reports generate their uuid on the device).
-- Charters/events use ON DELETE RESTRICT on purpose: patient records must not
-- vanish because an account or event was deleted — deactivate accounts instead.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  charter_id uuid not null references public.profiles(id) on delete restrict,
  team_leader_id uuid references public.profiles(id) on delete set null,
  chief_complaint text not null,
  patient_name text not null,
  age int check (age between 0 and 130),
  sex text check (sex in ('M', 'F')),
  address text,
  care_given text,
  signature_url text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  review_notes text,
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_event_idx on public.reports (event_id);
create index reports_charter_idx on public.reports (charter_id);
create index reports_status_created_idx on public.reports (status, created_at desc);
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- One row per vitals check — the repeating TIME / TEMP / PR / RR / BP / SPO2
-- row on the paper form.
create table public.vitals_readings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  time_taken timestamptz not null default now(),
  temp numeric(4, 1),
  pr int,
  rr int,
  bp_systolic int,
  bp_diastolic int,
  spo2 int,
  created_at timestamptz not null default now()
);
create index vitals_readings_report_idx on public.vitals_readings (report_id);

-- ---------------------------------------------------------------------------
-- 4. Row-level security — admin side only.
--    Team Leader and Charter policies come with their own page batches.
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_assignments enable row level security;
alter table public.reports enable row level security;
alter table public.vitals_readings enable row level security;

-- profiles (RLS already enabled in batch 1; "view own profile" policy exists)
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "Admins can update profiles"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- !! Do NOT add a "users can update their own profile" policy as-is: it would
-- !! let anyone set their own role to 'admin'. When you build Edit Profile,
-- !! restrict it to name/photo columns (column privileges or an RPC function).

create policy "Admins manage events"
  on public.events for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage event assignments"
  on public.event_assignments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins see submitted/reviewed reports only — a charter's unfinished draft
-- stays private to that charter.
create policy "Admins can view submitted reports"
  on public.reports for select to authenticated
  using (public.is_admin() and status <> 'draft');

create policy "Admins can update submitted reports"
  on public.reports for update to authenticated
  using (public.is_admin() and status <> 'draft')
  with check (public.is_admin() and status <> 'draft');

create policy "Admins can view vitals of submitted reports"
  on public.vitals_readings for select to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.reports r
      where r.id = report_id and r.status <> 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Make yourself the first admin (edit the email, then run this block).
--    First create the user in Supabase: Authentication -> Users -> Add user.
-- ---------------------------------------------------------------------------
-- insert into public.profiles (id, email, full_name, role)
-- select id, email, 'Your Name', 'admin'
-- from auth.users
-- where email = 'you@example.com';
