-- RedAid: "Reviewed by", notification sender names, and the 7-day cleanup after export
-- (Priority 4: items 13, 12 and 9).
-- Run after 20261025000400_submit_report.sql on BOTH Supabase projects.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 13. Who reviewed a report
-- ---------------------------------------------------------------------------
-- Before: the app guessed the reviewer from the latest note, so it showed "—"
-- when a Team Leader reviewed without a note, and changed name when someone
-- added a note later. Now the database records it when the status becomes
-- Reviewed. The name is stored too, so a Charter can see it even when the
-- reviewer is an Admin they don't otherwise see.

alter table public.patient_reports
  add column if not exists reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists reviewed_by_name text,
  add column if not exists reviewed_at timestamptz;

create or replace function public.stamp_report_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'Reviewed' and old.status is distinct from 'Reviewed' then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
    new.reviewed_by_name := (
      select nullif(btrim(first_name || ' ' || last_name), '') from public.users where id = auth.uid()
    );
  elsif new.status = 'Pending' then
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.reviewed_by_name := null;
  else
    -- Already reviewed: nobody can rewrite who/when.
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by_name := old.reviewed_by_name;
  end if;
  return new;
end;
$$;

-- The backfill below must run with the trigger off (the trigger would keep the
-- old empty values), so drop it first and recreate it after.
drop trigger if exists patient_reports_stamp_review on public.patient_reports;

-- Existing reviewed reports: best guess is the first note's author, else unknown.
update public.patient_reports pr
set reviewed_by = n.remarked_by,
    reviewed_by_name = nullif(btrim(u.first_name || ' ' || u.last_name), ''),
    reviewed_at = coalesce(n.created_at, pr.updated_at)
from (
  select distinct on (patient_report_id) patient_report_id, remarked_by, created_at
  from public.report_notes
  order by patient_report_id, created_at
) n
join public.users u on u.id = n.remarked_by
where pr.status = 'Reviewed' and pr.reviewed_at is null and n.patient_report_id = pr.id;

update public.patient_reports
set reviewed_at = updated_at
where status = 'Reviewed' and reviewed_at is null;

create trigger patient_reports_stamp_review
  before update on public.patient_reports
  for each row execute function public.stamp_report_review();

-- ---------------------------------------------------------------------------
-- 12. Notification sender names (for the bell)
-- ---------------------------------------------------------------------------

alter table public.notifications
  add column if not exists sender_name text;

create or replace function public.create_notification(
  p_receiver_id uuid,
  p_sender_id uuid,
  p_type public.notification_type,
  p_event_id uuid default null,
  p_vital_signs_id uuid default null,
  p_note_id uuid default null,
  p_patient_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.notifications
    (id, receiver_id, sender_id, sender_name, type, event_id, vital_signs_id, note_id, patient_report_id)
  values (
    v_id, p_receiver_id, p_sender_id,
    (select nullif(btrim(first_name || ' ' || last_name), '') from public.users where id = p_sender_id),
    p_type, p_event_id, p_vital_signs_id, p_note_id, p_patient_report_id
  );
  return v_id;
end;
$$;

-- Still internal only (see 20261025000300_security_hardening.sql).
revoke all on function public.create_notification(uuid, uuid, public.notification_type, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

update public.notifications n
set sender_name = nullif(btrim(u.first_name || ' ' || u.last_name), '')
from public.users u
where u.id = n.sender_id and n.sender_name is null;

-- People may only mark their own notifications read, not rewrite them.
create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.receiver_id := old.receiver_id;
    new.sender_id := old.sender_id;
    new.sender_name := old.sender_name;
    new.type := old.type;
    new.event_id := old.event_id;
    new.vital_signs_id := old.vital_signs_id;
    new.note_id := old.note_id;
    new.patient_report_id := old.patient_report_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_protect_fields on public.notifications;
create trigger notifications_protect_fields
  before update on public.notifications
  for each row execute function public.protect_notification_fields();

-- ---------------------------------------------------------------------------
-- 9. Delete patient data 7 days after an event is exported
-- ---------------------------------------------------------------------------
-- Before, this never happened: the Export button didn't mark events exported,
-- the cleanup crashed (its audit entry had no "performed by" when run on a
-- schedule), and it only hid the event without deleting any patient data.
-- It also measured 7 days from updated_at, which any edit reset.

alter table public.events
  add column if not exists exported_at timestamptz,
  add column if not exists patient_data_deleted_at timestamptz;

update public.events set exported_at = updated_at where is_exported and exported_at is null;

-- Scheduled jobs have no signed-in user: allow "performed by" to be empty (= system).
alter table public.audit_logs_event alter column action_performer drop not null;
alter table public.audit_logs_patient alter column action_performer drop not null;

-- The 7-day clock starts at the FIRST export; exporting again doesn't restart it.
create or replace function public.mark_event_exported(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_first boolean;
begin
  if v_caller is null or not public.can_lead_event(p_event_id) then
    raise exception 'Only a Team Leader or Admin of this event can mark it exported' using errcode = '42501';
  end if;

  select exported_at is null into v_first from public.events where id = p_event_id;
  if v_first is null then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  update public.events
  set is_exported = true,
      exported_at = coalesce(exported_at, now())
  where id = p_event_id;

  if v_first then
    perform public.log_event_audit(p_event_id, 'UPDATE', 'is_exported',
      coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
        || ' exported the reports; patient data will be deleted after 7 days');
  end if;
end;
$$;

revoke all on function public.mark_event_exported(uuid) from public, anon;
grant execute on function public.mark_event_exported(uuid) to authenticated;

-- Deletes the patients (and with them their reports, vitals, notes and report
-- notifications) of every event exported more than 7 days ago, hides the event,
-- and returns the signature file paths so the caller can delete those files
-- from Storage. Only the server (service role) can run it: the daily job in
-- src/app/api/cron/cleanup-exported/route.ts.
drop function if exists public.purge_exported_events();
create or replace function public.purge_exported_events()
returns table (purged_event_id uuid, signature_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_count integer;
begin
  for v_event in
    select e.id from public.events e
    where e.exported_at is not null
      and e.exported_at < now() - interval '7 days'
      and e.patient_data_deleted_at is null
  loop
    -- Hand back the signature files before the rows that point to them go.
    return query
      select v_event.id, pr.signature_url
      from public.patient_reports pr
      join public.patients p on p.id = pr.patient_id
      where p.event_id = v_event.id and pr.signature_url is not null;

    delete from public.patients p where p.event_id = v_event.id;
    get diagnostics v_count = row_count;

    update public.events e
    set patient_data_deleted_at = now(),
        is_deleted = true
    where e.id = v_event.id;

    insert into public.audit_logs_event (event_id, action_performed, action_performer, affected_resource_identifier, log_description)
    values (v_event.id, 'DELETE', null, 'patients',
      'Automatic cleanup: deleted ' || v_count || ' patient record(s) 7 days after export');
  end loop;
end;
$$;

revoke all on function public.purge_exported_events() from public, anon, authenticated;

-- Kept for anyone who scheduled it with pg_cron. Prefer the daily server job,
-- which also deletes the signature files from Storage.
create or replace function public.cleanup_exported_events()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform count(*) from public.purge_exported_events();
end;
$$;

revoke all on function public.cleanup_exported_events() from public, anon, authenticated;
