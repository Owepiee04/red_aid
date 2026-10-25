-- RedAid: submit a patient report in one step (Priority 3, item 6).
-- Run after 20261025000300_security_hardening.sql on BOTH Supabase projects.
-- Safe to run more than once.
--
-- Before: the app saved the patient, then the report, then the vitals as three
-- separate requests. If the signal dropped in between, pressing Submit again
-- created a second patient and then failed forever with "duplicate key", leaving
-- a report with no vitals.
--
-- Now: submit_report() saves all three in ONE transaction (everything or
-- nothing), and it's safe to call again with the same report id: if that report
-- was already saved (e.g. the reply was lost), it just returns the id.
--
-- SECURITY INVOKER on purpose: the normal rules still apply to the person
-- submitting (verified charter, duty open, account active), exactly as before.

create or replace function public.submit_report(
  p_report_id uuid,
  p_event_id uuid,
  p_patient_name text,
  p_patient_age int,
  p_patient_sex public.sex_type,
  p_patient_address text,
  p_chief_complaint text,
  p_care_given text,
  p_signature_url text,
  p_vitals jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_patient_id uuid;
begin
  if v_caller is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  -- Already saved by an earlier attempt? Then there's nothing to do.
  if exists (select 1 from public.patient_reports where id = p_report_id and reported_by = v_caller) then
    return p_report_id;
  end if;

  if btrim(coalesce(p_patient_name, '')) = '' or btrim(coalesce(p_patient_address, '')) = ''
     or btrim(coalesce(p_chief_complaint, '')) = '' or btrim(coalesce(p_care_given, '')) = '' then
    raise exception 'Please fill in the patient, complaint and care given.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_vitals, '[]'::jsonb)) <> 'array' then
    raise exception 'Vitals must be a list.' using errcode = '22023';
  end if;

  insert into public.patients (name, age, sex, event_id, address, added_by)
  values (btrim(p_patient_name), p_patient_age, p_patient_sex, p_event_id, btrim(p_patient_address), v_caller)
  returning id into v_patient_id;

  insert into public.patient_reports (id, patient_id, chief_complaint, care_given, signature_url, status, reported_by)
  values (p_report_id, v_patient_id, btrim(p_chief_complaint), btrim(p_care_given), p_signature_url, 'Pending', v_caller);

  insert into public.vital_signs (
    patient_report_id, created_at, temperature, pulse_rate_per_minute, respiration_rate_per_minute,
    blood_pressure_systolic, blood_pressure_diastolic, oxygen_level
  )
  select p_report_id, coalesce(v.created_at, now()), v.temperature, v.pulse_rate_per_minute,
         v.respiration_rate_per_minute, v.blood_pressure_systolic, v.blood_pressure_diastolic, v.oxygen_level
  from jsonb_to_recordset(coalesce(p_vitals, '[]'::jsonb)) as v(
    created_at timestamptz,
    temperature numeric,
    pulse_rate_per_minute int,
    respiration_rate_per_minute int,
    blood_pressure_systolic int,
    blood_pressure_diastolic int,
    oxygen_level int
  );

  -- Tell the event's Team Leaders. A failed notification must never undo the
  -- report, so it runs in its own sub-block.
  begin
    perform public.notify_report_submitted(p_report_id);
  exception when others then
    null;
  end;

  return p_report_id;
end;
$$;

revoke all on function public.submit_report(uuid, uuid, text, int, public.sex_type, text, text, text, text, jsonb) from public, anon;
grant execute on function public.submit_report(uuid, uuid, text, int, public.sex_type, text, text, text, text, jsonb) to authenticated;
