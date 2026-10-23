-- RedAid: Event Members table
-- Run after events table.

create type public.member_role as enum ('TL', 'Admin', 'First Aider', 'Charter');

create table public.event_members (
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  member_role public.member_role not null,
  is_verified boolean not null default false,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index event_members_event_idx on public.event_members (event_id);
create index event_members_user_idx on public.event_members (user_id);
create index event_members_verified_idx on public.event_members (is_verified);

create trigger event_members_set_updated_at
  before update on public.event_members
  for each row execute function public.set_updated_at();

alter table public.event_members enable row level security;

-- Helper functions for RLS
create or replace function public.is_event_member(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid()
  );
$$;

create or replace function public.is_event_admin(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid() and member_role in ('Admin', 'TL')
  );
$$;

create or replace function public.is_event_tl(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event and user_id = auth.uid() and member_role = 'TL'
  );
$$;

revoke all on function public.is_event_member(uuid), public.is_event_admin(uuid), public.is_event_tl(uuid) from public;
grant execute on function public.is_event_member(uuid), public.is_event_admin(uuid), public.is_event_tl(uuid) to authenticated;

-- Policy on events table (references event_members table)
create policy "Event members can view events they belong to"
  on public.events for select
  using (public.is_event_member(id));

-- Policies
create policy "Event members can view members of their events"
  on public.event_members for select
  using (public.is_event_member(event_id));

create policy "Event admins can manage members"
  on public.event_members for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

create policy "Team leaders can verify charters"
  on public.event_members for update
  using (
    public.is_event_tl(event_id)
    and member_role = 'Charter'
  )
  with check (
    public.is_event_tl(event_id)
    and member_role = 'Charter'
  );

-- Users can view their own memberships
create policy "Users can view own memberships"
  on public.event_members for select
  using (user_id = auth.uid());