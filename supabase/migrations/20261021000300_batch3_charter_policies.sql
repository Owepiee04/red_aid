-- RedAid batch 3: Charter permissions, the verification gate, and signature storage.
-- Run AFTER batch 2's SQL. Re-running will error on "already exists" — expected.

-- ---------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER so policies don't recurse into
--    the very tables they protect)
-- ---------------------------------------------------------------------------

-- Is the signed-in user assigned (any duty role) to this event?
create or replace function public.is_on_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_assignments
    where event_id = p_event and user_id = (select auth.uid())
  );
$$;

-- THE VERIFICATION GATE: is the signed-in charter verified for this event,
-- and is the event today (Philippine time)?
create or replace function public.can_chart_for_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.event_assignments a
    join public.events e on e.id = a.event_id
    where a.event_id = p_event
      and a.user_id = (select auth.uid())
      and a.duty_role = 'charter'
      and a.verified
      and e.date = (now() at time zone 'Asia/Manila')::date
  );
$$;

-- Do the signed-in user and p_user share at least one event? (lets a charter
-- see the name of their Team Leader, and nobody else's profile)
create or replace function public.shares_event_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.event_assignments mine
    join public.event_assignments theirs on theirs.event_id = mine.event_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

revoke all on function public.is_on_event(uuid), public.can_chart_for_event(uuid),
  public.shares_event_with(uuid) from public;
grant execute on function public.is_on_event(uuid), public.can_chart_for_event(uuid),
  public.shares_event_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------------

create policy "Members see events they are assigned to"
  on public.events for select to authenticated
  using (public.is_on_event(id));

create policy "Members see assignments on their events"
  on public.event_assignments for select to authenticated
  using (public.is_on_event(event_id));

create policy "Members see profiles of people on their events"
  on public.profiles for select to authenticated
  using (public.shares_event_with(id));

create policy "Charters see their own reports"
  on public.reports for select to authenticated
  using (charter_id = (select auth.uid()));

-- Can't chart unless verified for an event that is today.
-- This is enforced in the database, so editing the app can't bypass it.
create policy "Verified charters can create reports"
  on public.reports for insert to authenticated
  with check (
    charter_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.can_chart_for_event(event_id)
  );

create policy "Charters can edit their own drafts"
  on public.reports for update to authenticated
  using (charter_id = (select auth.uid()) and status = 'draft')
  with check (
    charter_id = (select auth.uid())
    and status in ('draft', 'submitted')
    and public.can_chart_for_event(event_id)
  );

create policy "Charters see vitals of their own reports"
  on public.vitals_readings for select to authenticated
  using (exists (
    select 1 from public.reports r
    where r.id = report_id and r.charter_id = (select auth.uid())
  ));

create policy "Charters add vitals to their own reports"
  on public.vitals_readings for insert to authenticated
  with check (exists (
    select 1 from public.reports r
    where r.id = report_id and r.charter_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 3. submit_report(): saves the report + all its vitals rows in ONE transaction
--    (so a failed vitals insert can't leave a half-saved report).
--    SECURITY INVOKER: every policy above still applies.
--    The app generates the report id, so retrying a submit can't duplicate it.
-- ---------------------------------------------------------------------------
create or replace function public.submit_report(p_report jsonb, p_vitals jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_report->>'id')::uuid;
begin
  insert into public.reports (
    id, event_id, charter_id, team_leader_id, chief_complaint, patient_name,
    age, sex, address, care_given, signature_url, status, submitted_at
  ) values (
    v_id,
    (p_report->>'event_id')::uuid,
    (select auth.uid()),
    nullif(p_report->>'team_leader_id', '')::uuid,
    p_report->>'chief_complaint',
    p_report->>'patient_name',
    nullif(p_report->>'age', '')::int,
    nullif(p_report->>'sex', ''),
    p_report->>'address',
    p_report->>'care_given',
    p_report->>'signature_url',
    'submitted',
    now()
  )
  on conflict (id) do nothing;

  if not found then
    return v_id; -- already saved by an earlier attempt
  end if;

  insert into public.vitals_readings (
    report_id, time_taken, temp, pr, rr, bp_systolic, bp_diastolic, spo2
  )
  select
    v_id,
    (x->>'time_taken')::timestamptz,
    nullif(x->>'temp', '')::numeric,
    nullif(x->>'pr', '')::int,
    nullif(x->>'rr', '')::int,
    nullif(x->>'bp_systolic', '')::int,
    nullif(x->>'bp_diastolic', '')::int,
    nullif(x->>'spo2', '')::int
  from jsonb_array_elements(p_vitals) as x;

  return v_id;
end;
$$;

revoke all on function public.submit_report(jsonb, jsonb) from public;
grant execute on function public.submit_report(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Private storage bucket for signature images.
--    Files live at <user id>/<report id>.png. Only the uploader and admins can read.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

create policy "Users upload signatures to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users replace their own signatures"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners and admins read signatures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );
