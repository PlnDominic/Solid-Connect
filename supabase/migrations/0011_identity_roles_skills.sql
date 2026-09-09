-- Phase B: application users, multi-role membership, skills taxonomy.
-- Keeps profiles.role as the active UX mode for backwards compatibility.
-- No hard FK to auth.users (seed profiles remain valid).

-- ── roles ───────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code in (
      'CUSTOMER',
      'PROVIDER',
      'PROFESSIONAL',
      'ORGANIZATION_MEMBER',
      'ADMIN',
      'SUPER_ADMIN'
    )),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name) values
  ('CUSTOMER', 'Customer'),
  ('PROVIDER', 'Service Provider'),
  ('PROFESSIONAL', 'Experienced Professional'),
  ('ORGANIZATION_MEMBER', 'Organization Member'),
  ('ADMIN', 'Administrator'),
  ('SUPER_ADMIN', 'Super Administrator')
on conflict (code) do nothing;

-- ── users (application identity) ────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text,
  phone text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'PENDING', 'SUSPENDED', 'DISABLED')),
  first_name text,
  last_name text,
  avatar_url text,
  preferred_language text not null default 'en',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_phone_idx on public.users (phone);

-- ── user_roles ──────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_role_idx on public.user_roles (role_id);

-- ── skills ──────────────────────────────────────────────────────────────
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories(id),
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists skills_category_idx on public.skills (category_id);

-- ── provider_skills ─────────────────────────────────────────────────────
create table if not exists public.provider_skills (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  years_experience integer not null default 0 check (years_experience >= 0),
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider_id, skill_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.skills enable row level security;
alter table public.provider_skills enable row level security;

create policy "roles are publicly readable" on public.roles for select using (true);

create policy "users read own row" on public.users
  for select using (auth.uid() = auth_user_id);
create policy "users update own row" on public.users
  for update using (auth.uid() = auth_user_id);

create policy "user_roles readable by owner" on public.user_roles
  for select using (
    exists (
      select 1 from public.users u
      where u.id = user_id and u.auth_user_id = auth.uid()
    )
  );

create policy "skills are publicly readable" on public.skills
  for select using (status = 'ACTIVE');

create policy "provider_skills publicly readable" on public.provider_skills
  for select using (true);
create policy "providers manage own skills" on public.provider_skills
  for all using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Admins (existing is_admin()) can read all users/roles when function exists.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_admin'
  ) then
    execute $p$
      create policy "admins read users" on public.users
        for select using (public.is_admin())
    $p$;
    execute $p$
      create policy "admins read user_roles" on public.user_roles
        for select using (public.is_admin())
    $p$;
  end if;
exception when duplicate_object then null;
end $$;

-- ── seed skills from categories ─────────────────────────────────────────
insert into public.skills (category_id, name, description)
select c.id, c.name || ' · General', 'General ' || lower(c.name) || ' work'
from public.categories c
on conflict (category_id, name) do nothing;

-- ── backfill users + roles from profiles ────────────────────────────────
insert into public.users (auth_user_id, email, phone, first_name, last_name, avatar_url, status)
select
  p.id,
  p.email,
  p.phone,
  nullif(split_part(p.full_name, ' ', 1), ''),
  nullif(nullif(substr(p.full_name, length(split_part(p.full_name, ' ', 1)) + 2), ''), p.full_name),
  p.photo_url,
  'ACTIVE'
from public.profiles p
on conflict (auth_user_id) do nothing;

-- Every profile gets CUSTOMER
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.roles r on r.code = 'CUSTOMER'
on conflict do nothing;

-- Active providers also get PROVIDER (multi-role)
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.users u
join public.profiles p on p.id = u.auth_user_id
join public.roles r on r.code = 'PROVIDER'
where p.role = 'provider'
on conflict do nothing;

-- Existing admins get ADMIN role when admins table exists
do $$
begin
  if to_regclass('public.admins') is not null then
    insert into public.users (auth_user_id, email, status)
    select a.id, a.email, 'ACTIVE'
    from public.admins a
    on conflict (auth_user_id) do update set email = excluded.email;

    insert into public.user_roles (user_id, role_id)
    select u.id, r.id
    from public.admins a
    join public.users u on u.auth_user_id = a.id
    join public.roles r on r.code = 'ADMIN'
    on conflict do nothing;
  end if;
end $$;
