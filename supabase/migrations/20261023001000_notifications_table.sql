-- RedAid: Notifications table
-- Run after all core tables.

create type public.notification_type as enum ('Report Pending', 'Verified', 'Note');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  receiver_id uuid not null references public.users(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  type public.notification_type not null,
  event_id uuid references public.events(id) on delete cascade,
  vital_signs_id uuid references public.vital_signs(id) on delete set null,
  note_id uuid references public.report_notes(id) on delete set null,
  patient_report_id uuid references public.patient_reports(id) on delete cascade,
  has_been_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_receiver_idx on public.notifications (receiver_id);
create index notifications_sender_idx on public.notifications (sender_id);
create index notifications_event_idx on public.notifications (event_id);
create index notifications_read_idx on public.notifications (has_been_read);
create index notifications_created_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (receiver_id = auth.uid());

create policy "Users can update their own notifications (mark read)"
  on public.notifications for update
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);