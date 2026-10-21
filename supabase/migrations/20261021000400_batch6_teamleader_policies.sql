-- RedAid batch 6: Team Leader permissions.
-- Run AFTER batches 2 and 3's SQL. Re-running will error on "already exists" — expected.

-- ---------------------------------------------------------------------------
-- 1. Helper: is the signed-in user a Team Leader on this event?
-- ---------------------------------------------------------------------------
create or replace function public.is_team_leader_on(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_assignments
    where event_id = p_event
      and user_id = (select auth.uid())
      and duty_role = 'team_leader'
  );
$$;

revoke all on function public.is_team_leader_on(uuid) from public;
grant execute on function public.is_team_leader_on(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Read access: Team Leaders see submitted/reviewed reports (never drafts)
--    from events they lead, plus those reports' vitals and signatures.
--    (Events, assignments and charter names are already readable via batch 3's
--    "members of the event" policies.)
-- ---------------------------------------------------------------------------
create policy "Team leaders see reports on their duties"
  on public.reports for select to authenticated
  using (status <> 'draft' and public.is_team_leader_on(event_id));

create policy "Team leaders see vitals on their duties"
  on public.vitals_readings for select to authenticated
  using (exists (
    select 1 from public.reports r
    where r.id = report_id
      and r.status <> 'draft'
      and public.is_team_leader_on(r.event_id)
  ));

create policy "Team leaders read signatures on their duties"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and exists (
      select 1 from public.reports r
      where r.signature_url = name
        and r.status <> 'draft'
        and public.is_team_leader_on(r.event_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Writes go through two narrow functions instead of open UPDATE policies,
--    so a Team Leader can approve charters and review reports — and nothing else
--    (no editing patient data, no reassigning people).
-- ---------------------------------------------------------------------------

-- Approve or revoke one charter for one event.
-- Allowed for events happening today or later (Philippine time).
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
begin
  if not public.is_team_leader_on(p_event) then
    raise exception 'You are not a Team Leader on this event.' using errcode = '42501';
  end if;

  select date into v_date from public.events where id = p_event;
  if v_date is null or v_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'This duty is already over.' using errcode = 'P0001';
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

-- Mark a submitted report as reviewed (with notes). Only a Team Leader on that
-- event can do it, and only once.
create or replace function public.review_report(p_report uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
begin
  select event_id, status into v_event, v_status from public.reports where id = p_report;

  if v_event is null or not public.is_team_leader_on(v_event) then
    raise exception 'You are not a Team Leader on this report''s event.' using errcode = '42501';
  end if;
  if v_status <> 'submitted' then
    raise exception 'Only submitted reports can be reviewed.' using errcode = 'P0001';
  end if;

  update public.reports
     set status       = 'reviewed',
         review_notes = nullif(trim(p_notes), ''),
         reviewed_by  = (select auth.uid()),
         reviewed_at  = now()
   where id = p_report;
end;
$$;

revoke all on function public.set_charter_verified(uuid, uuid, boolean),
  public.review_report(uuid, text) from public;
grant execute on function public.set_charter_verified(uuid, uuid, boolean),
  public.review_report(uuid, text) to authenticated;
