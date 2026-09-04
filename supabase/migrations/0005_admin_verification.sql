-- Solid Connect - admin auth + provider verification
-- Adds the admin role (a real Supabase-auth account listed in `admins`,
-- distinct from the mobile app's anonymous auth) and a real provider
-- verification workflow (submission + documents + review), replacing the
-- bare `profiles.provider_verified` boolean with something that has
-- evidence behind it. See
-- docs/superpowers/specs/2026-09-04-admin-verification-design.md.

-- ── admins ──────────────────────────────────────────────────────────────
create table public.admins (
  id uuid primary key references auth.users(id),
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Admin web app accounts. No self-serve signup - rows are inserted manually (SQL/service role) after creating the matching auth.users account.';

-- security definer so RLS policies elsewhere can call this without granting
-- broad read access to public.admins itself.
create function public.is_admin() returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

alter table public.admins enable row level security;

create policy "admins can read the admin list" on public.admins
  for select using (public.is_admin());

-- ── provider_verifications ─────────────────────────────────────────────
create table public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  doc_urls text[] not null default '{}',
  note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.admins(id),
  reviewed_at timestamptz
);

comment on table public.provider_verifications is 'One row per provider verification attempt. Approve/reject is done by the admin app via a service-role server action, not a client-facing RLS update policy - see the design spec for why.';

create index provider_verifications_provider_idx on public.provider_verifications(provider_id);
create index provider_verifications_status_idx on public.provider_verifications(status);

alter table public.provider_verifications enable row level security;

create policy "providers see their own verification submissions" on public.provider_verifications
  for select using (auth.uid() = provider_id);
create policy "admins see all verification submissions" on public.provider_verifications
  for select using (public.is_admin());
create policy "providers submit their own verification" on public.provider_verifications
  for insert with check (auth.uid() = provider_id);
-- deliberately no client-facing update policy: approve/reject runs through
-- the admin app's service-role server action instead (see design spec).

-- ── verification-docs storage bucket ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy "providers upload their own verification docs" on storage.objects
  for insert with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "providers read their own verification docs" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "admins read all verification docs" on storage.objects
  for select using (
    bucket_id = 'verification-docs' and public.is_admin()
  );
