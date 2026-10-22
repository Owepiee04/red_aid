-- RedAid: Patient Reports table
-- Run after patients table.

create type public.report_status as enum ('Pending', 'Reviewed');

create table public.patient_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  chief_complaint text not null,
  care_given text not null,
  signature_url text,
  status public.report_status not null default 'Pending',
  reported_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_reports_patient_idx on public.patient_reports (patient_id);
create index patient_reports_reported_by_idx on public.patient_reports (reported_by);
create index patient_reports_status_idx on public.patient_reports (status);

create trigger patient_reports_set_updated_at
  before update on public.patient_reports
  for each row execute function public.set_updated_at();

alter table public.patient_reports enable row level security;

create policy "Event members can view reports"
  on public.patient_reports for select
  using (
    exists (
      select 1 from public.patients p
      join public.event_members em on em.event_id = p.event_id
      where p.id = patient_reports.patient_id
        and em.user_id = auth.uid()
    )
  );

create policy "First aiders can create reports"
  on public.patient_reports for insert
  with check (
    reported_by = auth.uid()
    and exists (
      select 1 from public.patients p
      join public.event_members em on em.event_id = p.event_id
      where p.id = patient_reports.patient_id
        and em.user_id = auth.uid()
        and em.member_role in ('First Aider', 'Charter', 'TL', 'Admin')
    )
  );

create policy "Reporter can update pending reports"
  on public.patient_reports for update
  using (
    reported_by = auth.uid()
    and status = 'Pending'
  )
  with check (
    reported_by = auth.uid()
    and status in ('Pending', 'Reviewed')
  );

create policy "TL/Admin can update report status"
  on public.patient_reports for update
  using (
    status = 'Pending'
    and exists (
      select 1 from public.patients p
      join public.event_members em on em.event_id = p.event_id
      where p.id = patient_reports.patient_id
        and em.user_id = auth.uid()
        and em.member_role in ('TL', 'Admin')
    )
  )
  with check (
    exists (
      select 1 from public.patients p
      join public.event_members em on em.event_id = p.event_id
      where p.id = patient_reports.patient_id
        and em.user_id = auth.uid()
        and em.member_role in ('TL', 'Admin')
    )
  );