-- Admin foundation and provider verification workflow.
create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

create table public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  doc_urls text[] not null default '{}',
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.admins(id),
  reviewed_at timestamptz
);

create index provider_verifications_provider_idx on public.provider_verifications(provider_id);
create index provider_verifications_status_idx on public.provider_verifications(status, submitted_at);

alter table public.admins enable row level security;
alter table public.provider_verifications enable row level security;

create policy "admins read their directory" on public.admins for select using (public.is_admin());
create policy "providers read own verifications" on public.provider_verifications for select using (auth.uid() = provider_id);
create policy "providers submit own verification" on public.provider_verifications for insert with check (auth.uid() = provider_id);
create policy "admins read all verifications" on public.provider_verifications for select using (public.is_admin());

-- Keep documents private: providers only see their own prefix, admins see all.
insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy "providers upload their verification documents" on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "providers read their verification documents" on storage.objects for select
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins read verification documents" on storage.objects for select
  using (bucket_id = 'verification-docs' and public.is_admin());
