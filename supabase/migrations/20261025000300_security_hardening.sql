-- RedAid: security hardening (Priority 1).
-- Run after 20261025000200_end_duty.sql on BOTH Supabase projects
-- (Owepiee04's Project first, then red_aid_prod). Safe to run more than once.
--
--  1. review_patient_report let anyone through who wasn't on the event (NULL check).
--  2. Anyone (even with only the public anon key) could insert audit-log rows and
--     notifications, or call log_*_audit / create_notification with any sender.
--  4. Any signed-in user could create events, add anyone to them, and hard-delete
--     events (which cascades to patients and reports).
--  7. Deactivated accounts were only blocked on screen; the API still worked.
-- 15. Only platform Admins may add, remove or change people on an event. Team
--     Leaders keep verify/revoke and end/reopen duty (via their functions).
-- 14. Admins are no longer members of the events they create; existing creator
--     memberships are removed. Platform Admins see and manage every event anyway.

-- ---------------------------------------------------------------------------
-- 7. Deactivated accounts
-- ---------------------------------------------------------------------------

-- True only for a signed-in, active account.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_active from public.users where id = auth.uid()), false);
$$;

revoke all on function public.is_active_user() from public;
-- anon may call it (it just returns false), so signed-out requests get empty
-- results from the "Active accounts only" policies instead of an error.
grant execute on function public.is_active_user() to authenticated, anon;

-- A deactivated Admin loses Admin powers too.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin and is_active from public.users where id = auth.uid()), false);
$$;

-- RESTRICTIVE policies are ANDed with every other policy on the table, so a
-- deactivated account can't read or write anything through the API, whatever
-- the other policies say. (Database functions owned by postgres are unaffected.)
do $$
declare
  t text;
begin
  foreach t in array array[
    'events', 'event_members', 'patients', 'patient_reports', 'vital_signs',
    'report_notes', 'notifications', 'audit_logs_patient', 'audit_logs_event'
  ] loop
    execute format('drop policy if exists "Active accounts only" on public.%I', t);
    execute format(
      'create policy "Active accounts only" on public.%I as restrictive for all to authenticated, anon '
      'using (public.is_active_user()) with check (public.is_active_user())', t);
  end loop;
end;
$$;

-- users: a deactivated person can still read their own row, so the app can show
-- "Account deactivated" instead of an error.
drop policy if exists "Active accounts only" on public.users;
create policy "Active accounts only"
  on public.users as restrictive for all to authenticated, anon
  using (public.is_active_user() or id = auth.uid())
  with check (public.is_active_user());

-- Storage (signatures, avatars) follows the same rule.
drop policy if exists "Active accounts only" on storage.objects;
create policy "Active accounts only"
  on storage.objects as restrictive for all to authenticated, anon
  using (bucket_id not in ('signatures', 'avatars') or public.is_active_user())
  with check (bucket_id not in ('signatures', 'avatars') or public.is_active_user());

-- Event helpers also require an active account (used by many policies/functions).
create or replace function public.is_event_member(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid()
  );
$$;

create or replace function public.is_event_admin(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid() and member_role in ('Admin', 'TL')
  );
$$;

create or replace function public.is_event_tl(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid() and member_role = 'TL'
  );
$$;

create or replace function public.can_lead_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or (public.is_active_user() and exists (
        select 1 from public.event_members
        where event_id = p_event_id
          and user_id = auth.uid()
          and member_role in ('TL', 'Admin')
      ));
$$;

create or replace function public.can_manage_event_charters(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_lead_event(p_event_id);
$$;

create or replace function public.can_chart_for_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
     and public.is_charting_open(p_event)
     and exists (
       select 1 from public.event_members
       where event_id = p_event
         and user_id = auth.uid()
         and (member_role in ('TL', 'Admin')
              or (member_role in ('Charter', 'First Aider') and is_verified))
     );
$$;

-- ---------------------------------------------------------------------------
-- 1. review_patient_report: NULL-safe permission check
-- ---------------------------------------------------------------------------

create or replace function public.review_patient_report(p_report_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_event_id uuid;
  v_reporter uuid;
  v_note_id uuid;
begin
  select p.event_id, pr.reported_by into v_event_id, v_reporter
  from public.patient_reports pr
  join public.patients p on p.id = pr.patient_id
  where pr.id = p_report_id;

  if v_event_id is null then
    raise exception 'Report not found' using errcode = 'P0001';
  end if;

  if v_caller is null or not public.can_lead_event(v_event_id) then
    raise exception 'Only a Team Leader of this event or an Admin can review reports' using errcode = '42501';
  end if;

  update public.patient_reports
  set status = 'Reviewed',
      updated_at = now()
  where id = p_report_id;

  if p_notes is not null and btrim(p_notes) <> '' then
    insert into public.report_notes (patient_report_id, remarked_by, content)
    values (p_report_id, v_caller, btrim(p_notes))
    returning id into v_note_id;

    if v_reporter is distinct from v_caller then
      perform public.create_notification(
        v_reporter, v_caller, 'Note'::public.notification_type, v_event_id, null, v_note_id, p_report_id
      );
    end if;
  end if;

  perform public.log_patient_audit(v_event_id, 'UPDATE', p_report_id,
    coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
      || ' reviewed report ' || p_report_id);
end;
$$;

revoke all on function public.review_patient_report(uuid, text) from public, anon;
grant execute on function public.review_patient_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Audit logs and notifications: only the database's own functions write them
-- ---------------------------------------------------------------------------

drop policy if exists "System can insert audit logs" on public.audit_logs_patient;
drop policy if exists "System can insert event audit logs" on public.audit_logs_event;
drop policy if exists "System can insert notifications" on public.notifications;

-- These run inside other SECURITY DEFINER functions (as postgres), so app users
-- don't need to call them directly.
revoke all on function public.log_patient_audit(uuid, public.audit_action, uuid, text) from public, anon, authenticated;
revoke all on function public.log_event_audit(uuid, public.event_audit_action, text, text) from public, anon, authenticated;
revoke all on function public.create_notification(uuid, uuid, public.notification_type, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.cleanup_exported_events() from public, anon, authenticated;
revoke all on function public.get_event_members_by_role(uuid, public.member_role) from public, anon, authenticated;

-- What the app calls after a report is submitted: tells every Team Leader on the
-- event. Only the report's author can trigger it, and the sender is always them.
create or replace function public.notify_report_submitted(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_event_id uuid;
  v_count integer := 0;
  v_tl uuid;
begin
  select p.event_id into v_event_id
  from public.patient_reports pr
  join public.patients p on p.id = pr.patient_id
  where pr.id = p_report_id and pr.reported_by = v_caller;

  if v_caller is null or v_event_id is null or not public.is_active_user() then
    raise exception 'Only the person who submitted this report can send its notification' using errcode = '42501';
  end if;

  for v_tl in
    select user_id from public.event_members
    where event_id = v_event_id and member_role = 'TL' and user_id <> v_caller
  loop
    if not exists (
      select 1 from public.notifications
      where receiver_id = v_tl and patient_report_id = p_report_id and type = 'Report Pending'
    ) then
      perform public.create_notification(
        v_tl, v_caller, 'Report Pending'::public.notification_type, v_event_id, null, null, p_report_id
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.notify_report_submitted(uuid) from public, anon;
grant execute on function public.notify_report_submitted(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Events: only platform Admins create/edit them; nobody hard-deletes
-- ---------------------------------------------------------------------------

drop policy if exists "Event creators can manage their events" on public.events;
drop policy if exists "Platform admins can manage all events" on public.events;
drop policy if exists "Platform admins can view all events" on public.events;
drop policy if exists "Platform admins can create events" on public.events;
drop policy if exists "Platform admins can update events" on public.events;

create policy "Platform admins can view all events"
  on public.events for select using (public.is_platform_admin());
create policy "Platform admins can create events"
  on public.events for insert with check (public.is_platform_admin() and created_by = auth.uid());
create policy "Platform admins can update events"
  on public.events for update using (public.is_platform_admin()) with check (public.is_platform_admin());
-- No DELETE policy: events are only ever soft-deleted (is_deleted = true).

-- ---------------------------------------------------------------------------
-- 15. Event members: only platform Admins add, remove or change people
-- ---------------------------------------------------------------------------

drop policy if exists "Event admins can manage members" on public.event_members;
drop policy if exists "Event creators can add members" on public.event_members;
drop policy if exists "Team leaders can verify charters" on public.event_members;   -- use verify_charter()
drop policy if exists "Platform admins can manage event members" on public.event_members;

create policy "Platform admins can manage event members"
  on public.event_members for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 14. Admins are not members of the events they created
-- ---------------------------------------------------------------------------

delete from public.event_members em
using public.users u
where u.id = em.user_id
  and u.is_admin
  and em.member_role = 'Admin';
