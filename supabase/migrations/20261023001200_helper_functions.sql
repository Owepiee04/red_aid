-- RedAid: Helper functions for audit logging and notifications
-- Run after all tables and storage buckets.

-- Function to log patient audit events
create or replace function public.log_patient_audit(
  p_event_id uuid,
  p_action public.audit_action,
  p_affected_resource_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs_patient (event_id, action_performed, action_performer, affected_resource_id, log_description)
  values (p_event_id, p_action, auth.uid(), p_affected_resource_id, p_description);
end;
$$;

-- Function to log event audit events
create or replace function public.log_event_audit(
  p_event_id uuid,
  p_action public.event_audit_action,
  p_affected_resource_identifier text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs_event (event_id, action_performed, action_performer, affected_resource_identifier, log_description)
  values (p_event_id, p_action, auth.uid(), p_affected_resource_identifier, p_description);
end;
$$;

-- Function to create notification
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
  insert into public.notifications (id, receiver_id, sender_id, type, event_id, vital_signs_id, note_id, patient_report_id)
  values (v_id, p_receiver_id, p_sender_id, p_type, p_event_id, p_vital_signs_id, p_note_id, p_patient_report_id);
  return v_id;
end;
$$;

-- Function to get event members by role
create or replace function public.get_event_members_by_role(p_event_id uuid, p_role public.member_role)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.event_members
  where event_id = p_event_id and member_role = p_role;
$$;

-- Function to verify charter (TL/Admin only)
create or replace function public.verify_charter(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role public.member_role;
begin
  select member_role into v_role
  from public.event_members
  where event_id = p_event_id and user_id = v_caller;

  if v_role not in ('TL', 'Admin') then
    raise exception 'Only TL or Admin can verify charters' using errcode = '42501';
  end if;

  update public.event_members
  set is_verified = true,
      verified_by = v_caller,
      verified_at = now()
  where event_id = p_event_id and user_id = p_user_id and member_role = 'Charter';

  if not found then
    raise exception 'Charter not found or not a charter' using errcode = 'P0001';
  end if;

  -- Notify the verified user
  perform public.create_notification(
    p_user_id, v_caller, 'Verified'::public.notification_type, p_event_id
  );

  -- Log the verification
  perform public.log_patient_audit(p_event_id, 'UPDATE', p_user_id, 
    (select first_name || ' ' || last_name from public.users where id = v_caller) || ' verified charter ' ||
    (select first_name || ' ' || last_name from public.users where id = p_user_id)
  );
end;
$$;

-- Function to unverify charter (TL/Admin only)
create or replace function public.unverify_charter(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role public.member_role;
begin
  select member_role into v_role
  from public.event_members
  where event_id = p_event_id and user_id = v_caller;

  if v_role not in ('TL', 'Admin') then
    raise exception 'Only TL or Admin can unverify charters' using errcode = '42501';
  end if;

  update public.event_members
  set is_verified = false,
      verified_by = null,
      verified_at = null
  where event_id = p_event_id and user_id = p_user_id and member_role = 'Charter';

  if not found then
    raise exception 'Charter not found' using errcode = 'P0001';
  end if;
end;
$$;

-- Function to review patient report (TL/Admin only)
create or replace function public.review_patient_report(p_report_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_event_id uuid;
  v_role public.member_role;
  v_patient_id uuid;
begin
  select pr.patient_id, p.event_id into v_patient_id, v_event_id
  from public.patient_reports pr
  join public.patients p on p.id = pr.patient_id
  where pr.id = p_report_id;

  if v_event_id is null then
    raise exception 'Report not found' using errcode = 'P0001';
  end if;

  select member_role into v_role
  from public.event_members
  where event_id = v_event_id and user_id = v_caller;

  if v_role not in ('TL', 'Admin') then
    raise exception 'Only TL or Admin can review reports' using errcode = '42501';
  end if;

  update public.patient_reports
  set status = 'Reviewed',
      updated_at = now()
  where id = p_report_id;

  if p_notes is not null and trim(p_notes) != '' then
    insert into public.report_notes (patient_report_id, remarked_by, content)
    values (p_report_id, v_caller, trim(p_notes));

    -- Notify the reporter
    perform public.create_notification(
      (select reported_by from public.patient_reports where id = p_report_id),
      v_caller, 'Note'::public.notification_type, v_event_id, null, 
      (select id from public.report_notes where patient_report_id = p_report_id order by created_at desc limit 1),
      p_report_id
    );
  end if;

  -- Log the review
  perform public.log_patient_audit(v_event_id, 'UPDATE', p_report_id,
    (select first_name || ' ' || last_name from public.users where id = v_caller) || ' reviewed report ' || p_report_id
  );
end;
$$;

revoke all on function public.log_patient_audit(uuid, public.audit_action, uuid, text) from public;
grant execute on function public.log_patient_audit(uuid, public.audit_action, uuid, text) to authenticated;

revoke all on function public.log_event_audit(uuid, public.event_audit_action, text, text) from public;
grant execute on function public.log_event_audit(uuid, public.event_audit_action, text, text) to authenticated;

revoke all on function public.create_notification(uuid, uuid, public.notification_type, uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_notification(uuid, uuid, public.notification_type, uuid, uuid, uuid, uuid) to authenticated;

revoke all on function public.get_event_members_by_role(uuid, public.member_role) from public;
grant execute on function public.get_event_members_by_role(uuid, public.member_role) to authenticated;

revoke all on function public.verify_charter(uuid, uuid) from public;
grant execute on function public.verify_charter(uuid, uuid) to authenticated;

revoke all on function public.unverify_charter(uuid, uuid) from public;
grant execute on function public.unverify_charter(uuid, uuid) to authenticated;

revoke all on function public.review_patient_report(uuid, text) from public;
grant execute on function public.review_patient_report(uuid, text) to authenticated;