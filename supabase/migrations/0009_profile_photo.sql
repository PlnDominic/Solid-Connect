-- Profile photo + tagline, and the public bucket the photo lives in.
-- See docs/superpowers/specs/2026-09-06-profile-photo-design.md.

alter table public.profiles add column photo_url text;
alter table public.profiles add column tagline text;

insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "users upload their own profile photo" on storage.objects for insert
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own profile photo" on storage.objects for update
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own profile photo" on storage.objects for delete
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "profile photos are publicly readable" on storage.objects for select
  using (bucket_id = 'profile-photos');
