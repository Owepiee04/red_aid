-- RedAid: let people edit their own name and profile photo (Settings page).
-- Run once in the Supabase SQL editor, after all earlier migrations.
--
-- Why a function instead of an "update own profile" policy: a plain UPDATE
-- policy on profiles would also let someone change their own `role`,
-- `duty_role` or `active` columns (making themselves Admin). This function
-- only touches full_name and photo_url, and only on the caller's own row.

create or replace function public.update_my_profile(
  p_full_name text,
  p_photo_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := nullif(btrim(p_full_name), '');
  v_photo text := nullif(btrim(p_photo_url), '');
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  if v_name is null then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if char_length(v_name) > 120 then
    raise exception 'That name is too long (120 characters max).' using errcode = '22023';
  end if;

  -- A photo must live in the caller's own folder of the avatars bucket,
  -- the same rule the storage upload policy enforces.
  if v_photo is not null and split_part(v_photo, '/', 1) <> v_uid::text then
    raise exception 'That photo does not belong to your account.' using errcode = '42501';
  end if;

  update public.profiles
     set full_name = v_name,
         photo_url = v_photo
   where id = v_uid;
end;
$$;

revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
