-- RedAid: Report Notes table
-- Run after patient_reports table.

create table public.report_notes (
  id uuid primary key default gen_random_uuid(),
  patient_report_id uuid not null references public.patient_reports(id) on delete cascade,
  remarked_by uuid not null references public.users(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now()
);

create index report_notes_report_idx on public.report_notes (patient_report_id);
create index report_notes_remarked_by_idx on public.report_notes (remarked_by);

alter table public.report_notes enable row level security;

create policy "Event members can view notes"
  on public.report_notes for select
  using (
    exists (
      select 1 from public.patient_reports pr
      join public.patients p on p.id = pr.patient_id
      join public.event_members em on em.event_id = p.event_id
      where pr.id = report_notes.patient_report_id
        and em.user_id = auth.uid()
    )
  );

create policy "TL/Admin can add notes to pending reports"
  on public.report_notes for insert
  with check (
    remarked_by = auth.uid()
    and exists (
      select 1 from public.patient_reports pr
      join public.patients p on p.id = pr.patient_id
      join public.event_members em on em.event_id = p.event_id
      where pr.id = report_notes.patient_report_id
        and em.user_id = auth.uid()
        and em.member_role in ('TL', 'Admin')
        and pr.status = 'Pending'
    )
  );