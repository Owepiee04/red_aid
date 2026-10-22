-- RedAid: Vital Signs table
-- Run after patient_reports table.

create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  patient_report_id uuid not null references public.patient_reports(id) on delete cascade,
  temperature numeric(4,1),
  pulse_rate_per_minute int,
  respiration_rate_per_minute int,
  blood_pressure_systolic int,
  blood_pressure_diastolic int,
  oxygen_level int,
  created_at timestamptz not null default now()
);

create index vital_signs_report_idx on public.vital_signs (patient_report_id);

alter table public.vital_signs enable row level security;

create policy "Event members can view vitals"
  on public.vital_signs for select
  using (
    exists (
      select 1 from public.patient_reports pr
      join public.patients p on p.id = pr.patient_id
      join public.event_members em on em.event_id = p.event_id
      where pr.id = vital_signs.patient_report_id
        and em.user_id = auth.uid()
    )
  );

create policy "Reporters can add vitals to their reports"
  on public.vital_signs for insert
  with check (
    exists (
      select 1 from public.patient_reports pr
      where pr.id = vital_signs.patient_report_id
        and pr.reported_by = auth.uid()
    )
  );

create policy "Reporters can update vitals on their reports"
  on public.vital_signs for update
  using (
    exists (
      select 1 from public.patient_reports pr
      where pr.id = vital_signs.patient_report_id
        and pr.reported_by = auth.uid()
    )
  );