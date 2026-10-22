-- RedAid: Audit Logs for Event actions
-- Run after events table.

create type public.event_audit_action as enum ('CREATE', 'UPDATE', 'DELETE');

create table public.audit_logs_event (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  action_performed public.event_audit_action not null,
  action_performer uuid not null references public.users(id) on delete restrict,
  affected_resource_identifier text not null,
  log_description text not null,
  created_at timestamptz not null default now()
);

create index audit_logs_event_event_idx on public.audit_logs_event (event_id);
create index audit_logs_event_performer_idx on public.audit_logs_event (action_performer);
create index audit_logs_event_created_idx on public.audit_logs_event (created_at desc);

alter table public.audit_logs_event enable row level security;

create policy "Event admins can view event audit logs"
  on public.audit_logs_event for select
  using (
    exists (
      select 1 from public.event_members
      where event_id = audit_logs_event.event_id
        and user_id = auth.uid()
        and member_role in ('TL', 'Admin')
    )
  );

create policy "System can insert event audit logs"
  on public.audit_logs_event for insert
  with check (true);