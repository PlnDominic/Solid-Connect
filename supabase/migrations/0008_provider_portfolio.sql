-- Provider portfolio photos: public photos of past work, shown on a
-- provider's profile. See docs/superpowers/specs/2026-09-06-provider-portfolio-design.md.

create table public.provider_portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

create index provider_portfolio_photos_provider_idx
  on public.provider_portfolio_photos(provider_id, created_at);

alter table public.provider_portfolio_photos enable row level security;

-- Unlike verification docs, there's no admin/review workflow here - a
-- provider's own insert/delete plus unconditional public read is the
-- complete policy set.
create policy "portfolio photos are publicly readable"
  on public.provider_portfolio_photos for select using (true);
create policy "providers manage their own portfolio photos"
  on public.provider_portfolio_photos for insert with check (auth.uid() = provider_id);
create policy "providers delete their own portfolio photos"
  on public.provider_portfolio_photos for delete using (auth.uid() = provider_id);

insert into storage.buckets (id, name, public) values ('portfolio-photos', 'portfolio-photos', true)
on conflict (id) do nothing;

create policy "providers upload their portfolio photos" on storage.objects for insert
  with check (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "providers delete their portfolio photos" on storage.objects for delete
  using (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio photos are publicly readable" on storage.objects for select
  using (bucket_id = 'portfolio-photos');
