-- RedAid: Storage buckets for signatures and avatars
-- Run after all tables.

-- Signatures bucket (private)
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

create policy "Users upload signatures to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users replace their own signatures"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Owners and event admins can read signatures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.patient_reports pr
        join public.patients p on p.id = pr.patient_id
        join public.event_members em on em.event_id = p.event_id
        where pr.signature_url = storage.objects.name
          and em.user_id = auth.uid()
          and em.member_role in ('TL', 'Admin')
      )
    )
  );

-- Avatars bucket (private but viewable by event members)
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
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users replace their own avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );