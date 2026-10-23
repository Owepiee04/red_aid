-- RedAid: Events table
-- Run after users table.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  event_date timestamptz not null,
  description text,
  is_deleted boolean not null default false,
  is_exported boolean not null default false,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_event_date_idx on public.events (event_date);
create index events_created_by_idx on public.events (created_by);
create index events_is_deleted_idx on public.events (is_deleted);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "Event creators can manage their events"
  on public.events for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());