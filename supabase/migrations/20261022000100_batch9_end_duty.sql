-- RedAid batch 9: "End duty" — a Team Leader (or Admin) can end an event, and charters
-- automatically lose the ability to chart (after a 30-minute grace period).
-- Run AFTER batches 2, 3, 6 and 7. Safe to run once; it replaces two earlier functions.

-- ---------------------------------------------------------------------------
-- 1. Remember when (and by whom) an event was ended. NULL = still open.
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. The verification gate (replaces batch 3's version): same rules as before, plus
--    "the event hasn't been ended more than 30 minutes ago".
--    The grace period lets a charter finish and submit a report they had already
--    started when the Team Leader ended the duty.
--    (If you change 30 here, change CHARTING_GRACE_MINUTES in src/lib/duty.ts too.)
-- ---------------------------------------------------------------------------
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
      and (e.ended_at is null or e.ended_at > now() - interval '30 minutes')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. End / reopen. Only a Team Leader of that event, or an Admin.
-- ---------------------------------------------------------------------------
create or replace function public.end_event(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_ended timestamptz;
begin
  if not (public.is_team_leader_on(p_event) or public.is_admin()) then
    raise exception 'Only a Team Leader of this event (or an Admin) can end it.' using errcode = '42501';
  end if;

  select date, ended_at into v_date, v_ended from public.events where id = p_event;
  if v_date is null then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  if v_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This event has not started yet.' using errcode = 'P0001';
  end if;
  if v_ended is not null then
    raise exception 'This duty has already been ended.' using errcode = 'P0001';
  end if;

  update public.events
     set ended_at = now(), ended_by = (select auth.uid())
   where id = p_event;
end;
$$;

create or replace function public.reopen_event(p_event uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_team_leader_on(p_event) or public.is_admin()) then
    raise exception 'Only a Team Leader of this event (or an Admin) can reopen it.' using errcode = '42501';
  end if;

  update public.events
     set ended_at = null, ended_by = null
   where id = p_event and ended_at is not null;

  if not found then
    raise exception 'This duty is not ended.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.end_event(uuid), public.reopen_event(uuid) from public;
grant execute on function public.end_event(uuid), public.reopen_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Approving charters is not allowed on an ended duty (replaces batch 6's version).
--    Revoking still works. Reopen the duty first if you need to approve someone.
-- ---------------------------------------------------------------------------
create or replace function public.set_charter_verified(
  p_event uuid, p_user uuid, p_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_date date;
  v_ended timestamptz;
begin
  if not public.is_team_leader_on(p_event) then
    raise exception 'You are not a Team Leader on this event.' using errcode = '42501';
  end if;

  select date, ended_at into v_date, v_ended from public.events where id = p_event;
  if v_date is null or v_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'This duty is already over.' using errcode = 'P0001';
  end if;
  if p_verified and v_ended is not null then
    raise exception 'This duty has been ended. Reopen it before approving charters.' using errcode = 'P0001';
  end if;

  update public.event_assignments
     set verified    = p_verified,
         verified_at = case when p_verified then now() else null end,
         verified_by = case when p_verified then v_caller else null end
   where event_id = p_event and user_id = p_user and duty_role = 'charter';

  if not found then
    raise exception 'That charter is not assigned to this event.' using errcode = 'P0001';
  end if;
end;
$$;
