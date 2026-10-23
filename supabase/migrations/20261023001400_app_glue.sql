-- RedAid: app glue for the new schema
-- Run after 20261023001300_ttl_cleanup.sql.
--
-- Keeps the existing app's platform-level admin/duty-role routing working while the
-- event-level roles live in event_members, and fixes the gaps that stopped the new
-- tables from being usable from the browser.

-- ---------------------------------------------------------------------------
-- Platform-level columns on users
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists is_admin boolean not null default false;

alter table public.users
  add column if not exists duty_role text not null default 'charter'
  check (duty_role in ('team_leader', 'charter'));

alter table public.users
  add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- Create the matching public.users row when someone signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), '');
  v_last text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '');
begin
  insert into public.users (id, first_name, last_name)
  values (
    new.id,
    coalesce(v_first, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'User'),
    coalesce(v_last, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this migration.
insert into public.users (id, first_name, last_name)
select
  u.id,
  coalesce(
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'User'
  ),
  coalesce(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'last_name', '')), ''), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Platform admin helpers / user visibility
-- ---------------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Anyone who shares an event with you can be seen (needed for member names), and
-- platform admins can see everyone (needed for the Accounts screens).
create policy "Users can view members of shared events"
  on public.users for select
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.event_members me
      join public.event_members them on them.event_id = me.event_id
      where me.user_id = auth.uid()
        and them.user_id = users.id
    )
  );

create policy "Platform admins can manage users"
  on public.users for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- A normal user may edit their own name/photo, but never promote themselves.
create or replace function public.protect_user_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    if new.is_admin is distinct from old.is_admin
       or new.duty_role is distinct from old.duty_role
       or new.is_active is distinct from old.is_active then
      raise exception 'Only platform admins can change roles or account status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_privileges on public.users;
create trigger users_protect_privileges
  before update on public.users
  for each row execute function public.protect_user_privileges();

-- ---------------------------------------------------------------------------
-- Platform admins keep the old app's "see and manage everything" access
-- ---------------------------------------------------------------------------

create policy "Platform admins can manage all events"
  on public.events for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can view all event members"
  on public.event_members for select
  using (public.is_platform_admin());

create policy "Platform admins can view all patients"
  on public.patients for select
  using (public.is_platform_admin());

create policy "Platform admins can view all reports"
  on public.patient_reports for select
  using (public.is_platform_admin());

create policy "Platform admins can update reports"
  on public.patient_reports for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Platform admins can view all report notes"
  on public.report_notes for select
  using (public.is_platform_admin());

create policy "Platform admins can add report notes"
  on public.report_notes for insert
  with check (public.is_platform_admin());

create policy "Platform admins can view all patient audit logs"
  on public.audit_logs_patient for select
  using (public.is_platform_admin());

create policy "Platform admins can view all event audit logs"
  on public.audit_logs_event for select
  using (public.is_platform_admin());

create policy "Platform admins can read all signatures"
  on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Let an event creator add the first members (and therefore themselves as Admin)
-- ---------------------------------------------------------------------------

create policy "Event creators can add members"
  on public.event_members for insert
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_members.event_id
        and e.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- First platform admin
-- ---------------------------------------------------------------------------
-- After running this migration, promote your own account once in the SQL editor:
--   update public.users set is_admin = true where id = (
--     select id from auth.users where email = 'you@example.com'
--   );
