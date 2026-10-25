-- RedAid: let platform admins verify/unverify charters, and close a permission gap.
-- Fixes issue #26. Run after 20261023001400_app_glue.sql, on BOTH Supabase branches.
--
-- Before: verify_charter / unverify_charter looked up the caller's member_role on
-- the event and raised only when it was not 'TL' or 'Admin'. For someone who is
-- not on the event, member_role is NULL, and `NULL not in (...)` is NULL (not
-- true), so the check never raised. Since the functions are SECURITY DEFINER,
-- any signed-in user could verify or revoke any event's charters by calling the
-- RPC directly. Platform admins (users.is_admin) who weren't members of the
-- event were also not recognised.
--
-- After: allowed only for a platform admin, or a TL/Admin member of that event.
-- Everyone else (including people not on the event) gets errcode 42501.

create or replace function public.can_manage_event_charters(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
      or exists (
        select 1 from public.event_members
        where event_id = p_event_id
          and user_id = auth.uid()
          and member_role in ('TL', 'Admin')
      );
$$;

revoke all on function public.can_manage_event_charters(uuid) from public, anon;
grant execute on function public.can_manage_event_charters(uuid) to authenticated;

create or replace function public.verify_charter(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.can_manage_event_charters(p_event_id) then
    raise exception 'Only a Team Leader or Admin can verify charters' using errcode = '42501';
  end if;

  update public.event_members
  set is_verified = true,
      verified_by = v_caller,
      verified_at = now()
  where event_id = p_event_id and user_id = p_user_id and member_role = 'Charter';

  if not found then
    raise exception 'That person is not a charter on this event' using errcode = 'P0001';
  end if;

  -- Notify the verified user
  perform public.create_notification(
    p_user_id, v_caller, 'Verified'::public.notification_type, p_event_id
  );

  -- Log the verification
  perform public.log_patient_audit(p_event_id, 'UPDATE', p_user_id,
    coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
      || ' verified charter '
      || coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = p_user_id), p_user_id::text)
  );
end;
$$;

create or replace function public.unverify_charter(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.can_manage_event_charters(p_event_id) then
    raise exception 'Only a Team Leader or Admin can revoke charters' using errcode = '42501';
  end if;

  update public.event_members
  set is_verified = false,
      verified_by = null,
      verified_at = null
  where event_id = p_event_id and user_id = p_user_id and member_role = 'Charter';

  if not found then
    raise exception 'That person is not a charter on this event' using errcode = 'P0001';
  end if;

  -- Log the revocation (verifying was already logged; revoking wasn't).
  perform public.log_patient_audit(p_event_id, 'UPDATE', p_user_id,
    coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = v_caller), 'Someone')
      || ' revoked charter '
      || coalesce((select btrim(first_name || ' ' || last_name) from public.users where id = p_user_id), p_user_id::text)
  );
end;
$$;

revoke all on function public.verify_charter(uuid, uuid) from public, anon;
grant execute on function public.verify_charter(uuid, uuid) to authenticated;

revoke all on function public.unverify_charter(uuid, uuid) from public, anon;
grant execute on function public.unverify_charter(uuid, uuid) to authenticated;
