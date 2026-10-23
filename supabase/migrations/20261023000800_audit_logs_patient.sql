-- RedAid: Audit Logs for Patient actions
-- Run after patients and patient_reports tables.

create type public.audit_action as enum ('CREATE', 'READ', 'UPDATE', 'DELETE');

create table public.audit_logs_patient (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  action_performed public.audit_action not null,
  action_performer uuid not null references public.users(id) on delete restrict,
  affected_resource_id uuid not null,
  log_description text not null,
  created_at timestamptz not null default now()
);

create index audit_logs_patient_event_idx on public.audit_logs_patient (event_id);
create index audit_logs_patient_performer_idx on public.audit_logs_patient (action_performer);
create index audit_logs_patient_resource_idx on public.audit_logs_patient (affected_resource_id);
create index audit_logs_patient_created_idx on public.audit_logs_patient (created_at desc);

alter table public.audit_logs_patient enable row level security;

create policy "Event admins can view audit logs"
  on public.audit_logs_patient for select
  using (
    exists (
      select 1 from public.event_members
      where event_id = audit_logs_patient.event_id
        and user_id = auth.uid()
        and member_role in ('TL', 'Admin')
    )
  );

-- Insert policy for audit log creation (via functions)
create policy "System can insert audit logs"
  on public.audit_logs_patient for insert
  with check (true);