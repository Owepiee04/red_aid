-- RedAid: Patients table
-- Run after event_members table.

create type public.sex_type as enum ('M', 'F', 'Others');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  student_id text,
  age int not null check (age between 0 and 130),
  sex public.sex_type not null,
  event_id uuid not null references public.events(id) on delete cascade,
  address text not null,
  added_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_event_idx on public.patients (event_id);
create index patients_added_by_idx on public.patients (added_by);
create index patients_name_idx on public.patients (name);

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

alter table public.patients enable row level security;

-- Helper: can user add/view patients for this event?
create or replace function public.can_chart_for_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event
      and user_id = auth.uid()
      and member_role in ('Charter', 'TL', 'Admin')
      and (member_role != 'Charter' or is_verified)
  );
$$;

revoke all on function public.can_chart_for_event(uuid) from public;
grant execute on function public.can_chart_for_event(uuid) to authenticated;

create policy "Event members can view patients"
  on public.patients for select
  using (public.is_event_member(event_id));

create policy "Charters/TL/Admin can add patients"
  on public.patients for insert
  with check (
    added_by = auth.uid()
    and public.can_chart_for_event(event_id)
  );

create policy "Charters can update their own patients"
  on public.patients for update
  using (added_by = auth.uid() and public.can_chart_for_event(event_id))
  with check (added_by = auth.uid() and public.can_chart_for_event(event_id));