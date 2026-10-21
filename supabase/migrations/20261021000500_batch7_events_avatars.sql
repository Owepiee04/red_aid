-- RedAid batch 7: saving events (with their assigned people) and profile-photo storage.
-- Run AFTER batches 2, 3 and 6. Re-running will error on "already exists" — expected.

-- ---------------------------------------------------------------------------
-- 1. save_event(): create or edit an event AND its Team Leader / Charter
--    assignments in one transaction. SECURITY INVOKER, so only admins get through
--    (the admin policies on events / event_assignments still apply).
--
--    On edit: people removed from the lists are unassigned; people who stay keep
--    their current approval (verified) state; people newly added start unverified.
-- ---------------------------------------------------------------------------
create or replace function public.save_event(
  p_id uuid,
  p_event jsonb,
  p_team_leaders uuid[],
  p_charters uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
begin
  if p_id is null then
    insert into public.events (id, title, date, time, location, description, created_by)
    values (
      v_id,
      trim(p_event->>'title'),
      (p_event->>'date')::date,
      nullif(p_event->>'time', '')::time,
      nullif(trim(p_event->>'location'), ''),
      nullif(trim(p_event->>'description'), ''),
      (select auth.uid())
    );
  else
    update public.events set
      title       = trim(p_event->>'title'),
      date        = (p_event->>'date')::date,
      time        = nullif(p_event->>'time', '')::time,
      location    = nullif(trim(p_event->>'location'), ''),
      description = nullif(trim(p_event->>'description'), '')
    where id = p_id;
    if not found then
      raise exception 'Event not found.' using errcode = 'P0002';
    end if;
  end if;

  -- Unassign anyone no longer in the lists (or whose role on this event changed).
  delete from public.event_assignments
  where event_id = v_id
    and not (
      (duty_role = 'team_leader' and user_id = any(coalesce(p_team_leaders, '{}')))
      or (duty_role = 'charter' and user_id = any(coalesce(p_charters, '{}')))
    );

  insert into public.event_assignments (event_id, user_id, duty_role)
  select v_id, u, 'team_leader' from unnest(coalesce(p_team_leaders, '{}')) as u
  on conflict (event_id, user_id) do nothing;

  insert into public.event_assignments (event_id, user_id, duty_role)
  select v_id, u, 'charter' from unnest(coalesce(p_charters, '{}')) as u
  on conflict (event_id, user_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.save_event(uuid, jsonb, uuid[], uuid[]) from public;
grant execute on function public.save_event(uuid, jsonb, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profile photos: private bucket. Photos live at <user id>/<anything>.
--    Everyone signed in can SEE them (team members see each other's avatars);
--    each person can only upload into their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Signed-in users can view avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "Users upload avatars to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users replace their own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
