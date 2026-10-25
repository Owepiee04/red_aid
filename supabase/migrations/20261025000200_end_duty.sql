-- RedAid: End Duty on the new schema, plus charting-rule fixes.
-- Fixes issue #27. Run after 20261025000100_fix_verify_charter_permissions.sql,
-- on BOTH Supabase projects (develop first, then production).
-- Safe to run more than once.
--
-- 1. events.ended_at / ended_by, and end_event / reopen_event functions.
-- 2. Charting closes 30 minutes after a duty is ended (CHARTING_GRACE_MINUTES in
--    src/lib/duty.ts), for everyone on the event, enforced here, not just in the app.
-- 3. Report rules: only verified charters (and the event's TL/Admin) can create
--    reports and vitals, and a reporter can no longer mark their own report Reviewed.
-- 4. mark_event_exported had the same NULL permission bug as verify_charter (#26):
--    anyone could mark any event exported, which makes the cleanup delete it later.

-- ---------------------------------------------------------------------------
-- 1. Ending a duty
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references public.users(id) on delete set null;

-- Platform admin, or a TL/Admin member of the event. NULL-safe (unlike the old
-- `v_role not in (...)` checks, which let non-members through).
create or replace function public.can_lead_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.event_members
        where event_id = p_event_id
          and user_id = auth.uid()
          and member_role in ('TL', 'Admin')
      );
$$;

revoke all on function public.can_lead_event(uuid) from public, anon;
grant execute on function public.can_lead_event(uuid) to authenticated;

create or replace function public.end_event(p_event_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_ended timestamptz;
  v_was_open boolean;
begin
  if v_caller is null or not public.can_lead_event(p_event_id) then
    raise exception 'Only a Team Leader or Admin of this event can end the duty' using errcode = '42501';
  end if;

  select ended_at is null into v_was_open
  from public.events where id = p_event_id and not is_deleted;
  if v_was_open is null then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  -- Ending an already-ended duty keeps the first end time and isn't logged again.
  if v_was_open then
    update public.events
       set ended_at = now(),
           ended_by = v_caller
     where id = p_event_id;

    perform public.log_event_audit(p_event_id, 'UPDATE', 'ended_at',
      coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
        || ' ended the duty');
  end if;

  select ended_at into v_ended from public.events where id = p_event_id;
  return v_ended;
end;
$$;

create or replace function public.reopen_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.can_lead_event(p_event_id) then
    raise exception 'Only a Team Leader or Admin of this event can reopen the duty' using errcode = '42501';
  end if;

  update public.events
     set ended_at = null,
         ended_by = null
   where id = p_event_id and not is_deleted;

  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  perform public.log_event_audit(p_event_id, 'UPDATE', 'ended_at',
    coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
      || ' reopened the duty');
end;
$$;

revoke all on function public.end_event(uuid) from public, anon;
grant execute on function public.end_event(uuid) to authenticated;
revoke all on function public.reopen_event(uuid) from public, anon;
grant execute on function public.reopen_event(uuid) to authenticated;

-- Only these functions may change ended_at / ended_by. The "Event creators can
-- manage their events" and "Platform admins can manage all events" policies allow
-- direct updates to events, so guard the two columns with a trigger. Inside the
-- SECURITY DEFINER functions above, current_user is the function owner
-- (postgres), so they pass; app users updating the table directly run as
-- "authenticated" and are refused.
create or replace function public.protect_event_ended()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.ended_at is distinct from old.ended_at or new.ended_by is distinct from old.ended_by)
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Use End Duty / Reopen Duty to change whether a duty has ended' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists events_protect_ended on public.events;
create trigger events_protect_ended
  before update on public.events
  for each row execute function public.protect_event_ended();

-- ---------------------------------------------------------------------------
-- 2 + 3. Who can chart, and until when
-- ---------------------------------------------------------------------------

-- True while the event's duty is open, or ended less than 30 minutes ago.
create or replace function public.is_charting_open(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = p_event
      and not is_deleted
      and (ended_at is null or now() < ended_at + interval '30 minutes')
  );
$$;

revoke all on function public.is_charting_open(uuid) from public, anon;
grant execute on function public.is_charting_open(uuid) to authenticated;

-- Replaces the version from 20261023000400_patients_table.sql: same people
-- (verified Charters / First Aiders, TLs and event Admins), now also only while
-- charting is open.
create or replace function public.can_chart_for_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_charting_open(p_event)
     and exists (
       select 1 from public.event_members
       where event_id = p_event
         and user_id = auth.uid()
         and (member_role in ('TL', 'Admin')
              or (member_role in ('Charter', 'First Aider') and is_verified))
     );
$$;

-- Event of a report (used by the report and vitals rules below).
create or replace function public.event_of_report(p_report uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.event_id
  from public.patient_reports pr
  join public.patients p on p.id = pr.patient_id
  where pr.id = p_report;
$$;

revoke all on function public.event_of_report(uuid) from public, anon;
grant execute on function public.event_of_report(uuid) to authenticated;

-- Reports: creating one needs charting rights on the patient's event
-- (verified, duty open). Previously any member could, verified or not.
drop policy if exists "First aiders can create reports" on public.patient_reports;
drop policy if exists "Chartable members can create reports" on public.patient_reports;
create policy "Chartable members can create reports"
  on public.patient_reports for insert
  with check (
    reported_by = auth.uid()
    and exists (
      select 1 from public.patients p
      where p.id = patient_reports.patient_id
        and public.can_chart_for_event(p.event_id)
    )
  );

-- A reporter may edit their own Pending report while charting is open, and it
-- must stay Pending (previously they could set it to Reviewed themselves).
drop policy if exists "Reporter can update pending reports" on public.patient_reports;
create policy "Reporter can update pending reports"
  on public.patient_reports for update
  using (
    reported_by = auth.uid()
    and status = 'Pending'
    and exists (
      select 1 from public.patients p
      where p.id = patient_reports.patient_id
        and public.can_chart_for_event(p.event_id)
    )
  )
  with check (
    reported_by = auth.uid()
    and status = 'Pending'
  );

-- Vitals: added/edited only by the report's author while they can still chart.
drop policy if exists "Reporters can add vitals to their reports" on public.vital_signs;
create policy "Reporters can add vitals to their reports"
  on public.vital_signs for insert
  with check (
    exists (
      select 1 from public.patient_reports pr
      where pr.id = vital_signs.patient_report_id
        and pr.reported_by = auth.uid()
    )
    and public.can_chart_for_event(public.event_of_report(vital_signs.patient_report_id))
  );

drop policy if exists "Reporters can update vitals on their reports" on public.vital_signs;
create policy "Reporters can update vitals on their reports"
  on public.vital_signs for update
  using (
    exists (
      select 1 from public.patient_reports pr
      where pr.id = vital_signs.patient_report_id
        and pr.reported_by = auth.uid()
    )
    and public.can_chart_for_event(public.event_of_report(vital_signs.patient_report_id))
  );

-- ---------------------------------------------------------------------------
-- 4. mark_event_exported: same NULL-check fix as verify_charter
-- ---------------------------------------------------------------------------

create or replace function public.mark_event_exported(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.can_lead_event(p_event_id) then
    raise exception 'Only a Team Leader or Admin of this event can mark it exported' using errcode = '42501';
  end if;

  update public.events
  set is_exported = true,
      updated_at = now()
  where id = p_event_id;

  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  perform public.log_event_audit(p_event_id, 'UPDATE', 'is_exported',
    coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
      || ' marked event as exported');
end;
$$;

revoke all on function public.mark_event_exported(uuid) from public, anon;
grant execute on function public.mark_event_exported(uuid) to authenticated;
