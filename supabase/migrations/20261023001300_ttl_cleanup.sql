-- RedAid: TTL cleanup for patient data (7 days after export)
-- Run after all tables. Requires pg_cron extension enabled in Supabase.

-- Function to clean up old exported events and their patient data
create or replace function public.cleanup_exported_events()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_events uuid[];
begin
  -- Find events that were exported more than 7 days ago and not soft-deleted
  select array_agg(id) into v_deleted_events
  from public.events
  where is_exported = true
    and is_deleted = false
    and updated_at < now() - interval '7 days';

  if v_deleted_events is not null and array_length(v_deleted_events, 1) > 0 then
    -- Soft delete the events
    update public.events
    set is_deleted = true,
        updated_at = now()
    where id = any(v_deleted_events);

    -- Log the cleanup
    for i in 1..array_length(v_deleted_events, 1) loop
      perform public.log_event_audit(
        v_deleted_events[i],
        'DELETE',
        'event',
        'Event auto-deleted after 7-day TTL post-export'
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.cleanup_exported_events() from public;
grant execute on function public.cleanup_exported_events() to authenticated;

-- Schedule the cleanup to run daily at 3 AM (requires pg_cron)
-- Uncomment and run in Supabase SQL editor after enabling pg_cron:
-- select cron.schedule('cleanup-exported-events', '0 3 * * *', 'select public.cleanup_exported_events();');

-- Function to manually trigger export (called when user exports to Excel)
create or replace function public.mark_event_exported(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role public.member_role;
begin
  select member_role into v_role
  from public.event_members
  where event_id = p_event_id and user_id = v_caller;

  if v_role not in ('TL', 'Admin') then
    raise exception 'Only TL or Admin can mark event as exported' using errcode = '42501';
  end if;

  update public.events
  set is_exported = true,
      updated_at = now()
  where id = p_event_id;

  if not found then
    raise exception 'Event not found' using errcode = 'P0001';
  end if;

  perform public.log_event_audit(p_event_id, 'UPDATE', 'is_exported',
    (select first_name || ' ' || last_name from public.users where id = v_caller) || ' marked event as exported');
end;
$$;

revoke all on function public.mark_event_exported(uuid) from public;
grant execute on function public.mark_event_exported(uuid) to authenticated;