create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  duty_role text check (duty_role in ('team_leader', 'charter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile row.
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);
