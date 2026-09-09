-- Public storage bucket for photos attached to service requests.
-- URLs are stored on service_requests.photos (text[] from 0001_init).

insert into storage.buckets (id, name, public) values ('request-photos', 'request-photos', true)
on conflict (id) do nothing;

create policy "customers upload request photos" on storage.objects for insert
  with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "customers delete their request photos" on storage.objects for delete
  using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "request photos are publicly readable" on storage.objects for select
  using (bucket_id = 'request-photos');
