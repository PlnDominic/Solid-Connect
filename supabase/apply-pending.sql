-- Solid Connect: PENDING only (0009 already applied on this project)
-- Paste into Supabase Dashboard → SQL Editor → Run

-- ===== 0007_disputes.sql =====
-- Customer disputes on jobs. Types already reference this as 0007 in
-- src/types/database.ts. Resolution is an admin action.

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  reason text not null
    check (reason in ('not_completed', 'poor_quality', 'overcharged', 'no_show', 'other')),
  description text not null default '',
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create index disputes_status_idx on public.disputes(status, created_at desc);
create index disputes_provider_idx on public.disputes(provider_id);

alter table public.disputes enable row level security;

create policy "customers read their own disputes"
  on public.disputes for select
  using (auth.uid() = customer_id or auth.uid() = provider_id or public.is_admin());

create policy "customers open disputes on their jobs"
  on public.disputes for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.customer_id = auth.uid() and j.provider_id = provider_id
    )
  );

create policy "admins resolve disputes"
  on public.disputes for update
  using (public.is_admin());

-- ===== 0008_provider_portfolio.sql =====
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

-- ===== 0010_request_photos.sql =====
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

-- ===== seed (idempotent) =====
-- Solid Connect - service categories
-- Real reference data the app needs to function (category picker, request
-- forms, etc.) - split out from seed.sql, which also has fake demo
-- providers/customers/requests you likely don't want on a production
-- project. Safe to run on its own.

insert into public.categories (id, name, abbr, default_label, sort_order) values
  ('plumbing',   'Plumbing',   'PL', 'Plumbing · Pipe repair',    1),
  ('electrical', 'Electrical', 'EL', 'Electrical · Wiring',       2),
  ('carpentry',  'Carpentry',  'CA', 'Carpentry · Repair',        3),
  ('masonry',    'Masonry',    'MA', 'Masonry · Repair',          4),
  ('painting',   'Painting',   'PA', 'Painting · Interior',       5),
  ('welding',    'Welding',    'WE', 'Welding · Repair',          6),
  ('cleaning',   'Cleaning',   'CL', 'Cleaning · Deep clean',     7),
  ('ac_repair',  'AC repair',  'AC', 'AC repair · Servicing',     8)
on conflict (id) do nothing;

-- Solid Connect - demo seed data
-- Populates the marketplace with the same Accra-flavored sample data the
-- Claude Design prototype shipped with, so the app isn't empty on first run.
-- Seed rows are marked is_seed = true where applicable.

insert into public.categories (id, name, abbr, default_label, sort_order) values
  ('plumbing',   'Plumbing',   'PL', 'Plumbing · Pipe repair',    1),
  ('electrical', 'Electrical', 'EL', 'Electrical · Wiring',       2),
  ('carpentry',  'Carpentry',  'CA', 'Carpentry · Repair',        3),
  ('masonry',    'Masonry',    'MA', 'Masonry · Repair',          4),
  ('painting',   'Painting',   'PA', 'Painting · Interior',       5),
  ('welding',    'Welding',    'WE', 'Welding · Repair',          6),
  ('cleaning',   'Cleaning',   'CL', 'Cleaning · Deep clean',     7),
  ('ac_repair',  'AC repair',  'AC', 'AC repair · Servicing',     8)
on conflict (id) do nothing;

-- seed providers (the marketplace supply side you browse/quote/hire)
insert into public.profiles
  (id, role, full_name, initials, area, is_seed, provider_category,
   provider_rating, provider_jobs_count, provider_distance_km, provider_verified, provider_certified)
values
  ('11111111-1111-4111-8111-111111111111', 'provider', 'Kwesi Amankwah', 'KA', 'Achimota, Accra', true,
   'Plumber', 4.8, 126, 2.4, true, false),
  ('22222222-2222-4222-8222-222222222222', 'provider', 'Ama Boateng', 'AB', 'Achimota, Accra', true,
   'Plumber', 4.9, 212, 3.1, true, true),
  ('33333333-3333-4333-8333-333333333333', 'provider', 'Yaw Osei', 'YO', 'Achimota, Accra', true,
   'Electrician', 4.7, 89, 1.8, true, false),
  ('44444444-4444-4444-8444-444444444444', 'provider', 'Samuel Mensah', 'SM', 'Achimota, Accra', true,
   'Plumber', 4.6, 58, 4.7, true, false)
on conflict (id) do nothing;

-- seed customers (so the provider Feed has real "nearby requests" to browse)
insert into public.profiles (id, role, full_name, initials, area, is_seed) values
  ('55555555-5555-4555-8555-555555555555', 'customer', 'Efua Mensah', 'EM', 'Achimota, Accra', true),
  ('66666666-6666-4666-8666-666666666666', 'customer', 'Kojo Owusu', 'KO', 'Trasacco Valley, Accra', true)
on conflict (id) do nothing;

insert into public.service_requests
  (id, customer_id, category_id, category_label, description, budget_min, budget_max, location_label, status, created_at)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'plumbing',
   'Plumbing · Pipe repair', 'Kitchen sink has been leaking under the cabinet since yesterday.',
   300, 600, 'Achimota', 'open', now() - interval '12 minutes'),
  ('aaaaaaaa-0001-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', 'plumbing',
   'Plumbing · Water heater installation', 'New water heater needs to be installed in the main bathroom, unit already purchased.',
   800, 1200, 'Trasacco Valley', 'open', now() - interval '20 minutes'),
  ('aaaaaaaa-0001-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555', 'plumbing',
   'Plumbing · Bathroom pipe leak', 'Slow leak under the bathroom sink, needs inspection and repair.',
   200, 350, 'Airport Residential', 'open', now() - interval '1 hour')
on conflict (id) do nothing;

-- ===== 0011_identity_roles_skills.sql =====
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


-- ===== 0012_trust_location.sql (Phase C) =====
-- Phase C: PostGIS service areas, availability, verification levels.
create extension if not exists postgis;

-- Accra neighborhood centroids for CITY service areas / search fallback.
create table if not exists public.area_centroids (
  name text primary key,
  location geography(Point, 4326) not null
);

insert into public.area_centroids (name, location) values
  ('Achimota', ST_SetSRID(ST_MakePoint(-0.232, 5.627), 4326)::geography),
  ('Trasacco Valley', ST_SetSRID(ST_MakePoint(-0.158, 5.635), 4326)::geography),
  ('Airport Residential', ST_SetSRID(ST_MakePoint(-0.177, 5.605), 4326)::geography),
  ('Cantonments', ST_SetSRID(ST_MakePoint(-0.173, 5.575), 4326)::geography),
  ('Osu', ST_SetSRID(ST_MakePoint(-0.183, 5.558), 4326)::geography),
  ('Spintex', ST_SetSRID(ST_MakePoint(-0.098, 5.636), 4326)::geography),
  ('Tema', ST_SetSRID(ST_MakePoint(-0.017, 5.669), 4326)::geography),
  ('Dansoman', ST_SetSRID(ST_MakePoint(-0.266, 5.548), 4326)::geography)
on conflict (name) do nothing;

alter table public.profiles
  add column if not exists verification_level text not null default 'REGISTERED'
    check (verification_level in (
      'REGISTERED',
      'IDENTITY_VERIFIED',
      'PROFESSION_VERIFIED',
      'EXPERIENCE_VERIFIED',
      'SOLID_CONNECT_VERIFIED'
    ));

alter table public.profiles
  add column if not exists location geography(Point, 4326);

alter table public.profiles
  add column if not exists availability_mode text not null default 'SCHEDULE'
    check (availability_mode in ('AVAILABLE_NOW', 'UNAVAILABLE', 'SCHEDULE', 'PAUSED'));

-- Backfill verification_level from existing booleans
update public.profiles
set verification_level = case
  when provider_certified then 'SOLID_CONNECT_VERIFIED'
  when provider_verified then 'IDENTITY_VERIFIED'
  else 'REGISTERED'
end
where role = 'provider';

-- Approximate profile location from area name when possible
update public.profiles p
set location = a.location
from public.area_centroids a
where p.location is null
  and (
    p.area ilike a.name || '%'
    or p.area ilike '%' || a.name || '%'
  );

alter table public.provider_verifications
  add column if not exists verification_type text not null default 'IDENTITY'
    check (verification_type in ('IDENTITY', 'PROFESSION', 'EXPERIENCE', 'SOLID_CONNECT'));

create table if not exists public.provider_service_areas (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('RADIUS', 'CITY')),
  center geography(Point, 4326),
  radius_meters integer check (radius_meters is null or radius_meters > 0),
  city_name text references public.area_centroids(name),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'RADIUS' and center is not null and radius_meters is not null)
    or (type = 'CITY' and city_name is not null)
  )
);

create index if not exists provider_service_areas_provider_idx
  on public.provider_service_areas (provider_id);
create index if not exists provider_service_areas_center_gix
  on public.provider_service_areas using gist (center);

create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Africa/Accra',
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (provider_id, day_of_week, start_time, end_time)
);

create index if not exists provider_availability_provider_idx
  on public.provider_availability (provider_id);

create table if not exists public.provider_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  available boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  unique (provider_id, date)
);

-- RLS
alter table public.area_centroids enable row level security;
alter table public.provider_service_areas enable row level security;
alter table public.provider_availability enable row level security;
alter table public.provider_availability_exceptions enable row level security;

create policy "area centroids readable" on public.area_centroids for select using (true);

create policy "service areas readable" on public.provider_service_areas for select using (true);
create policy "providers manage own service areas" on public.provider_service_areas
  for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);

create policy "availability readable" on public.provider_availability for select using (true);
create policy "providers manage own availability" on public.provider_availability
  for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);

create policy "availability exceptions readable" on public.provider_availability_exceptions for select using (true);
create policy "providers manage own availability exceptions" on public.provider_availability_exceptions
  for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);

-- Geo search: providers whose RADIUS covers the point, or CITY matches nearest named area,
-- excluding suspended availability and inactive roles.
create or replace function public.search_providers_geo(
  p_lng double precision,
  p_lat double precision,
  p_radius_meters integer default 10000,
  p_category text default null,
  p_min_verification text default null
)
returns table (
  id uuid,
  full_name text,
  initials text,
  area text,
  photo_url text,
  tagline text,
  provider_category text,
  provider_rating numeric,
  provider_jobs_count integer,
  provider_verified boolean,
  provider_certified boolean,
  verification_level text,
  availability_mode text,
  distance_meters double precision
)
language sql
stable
as $$
  with origin as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as geom
  ),
  ranked as (
    select
      p.*,
      least(
        coalesce((
          select min(ST_Distance(o.geom, coalesce(sa.center, ac.location)))
          from public.provider_service_areas sa
          left join public.area_centroids ac on ac.name = sa.city_name
          where sa.provider_id = p.id
            and (
              (sa.type = 'RADIUS' and ST_DWithin(o.geom, sa.center, sa.radius_meters))
              or (sa.type = 'CITY' and ac.location is not null and ST_DWithin(o.geom, ac.location, p_radius_meters))
            )
        ), 1e12),
        coalesce(ST_Distance(o.geom, p.location), 1e12)
      ) as distance_meters
    from public.profiles p
    cross join origin o
    where p.role = 'provider'
      and p.availability_mode <> 'UNAVAILABLE'
      and p.availability_mode <> 'PAUSED'
      and (p_category is null or p.provider_category ilike '%' || p_category || '%')
      and (
        p_min_verification is null
        or p.verification_level = p_min_verification
        or (p_min_verification = 'IDENTITY_VERIFIED' and p.verification_level in (
          'IDENTITY_VERIFIED', 'PROFESSION_VERIFIED', 'EXPERIENCE_VERIFIED', 'SOLID_CONNECT_VERIFIED'
        ))
        or p.provider_verified = true
      )
  )
  select
    id, full_name, initials, area, photo_url, tagline, provider_category,
    provider_rating, provider_jobs_count, provider_verified, provider_certified,
    verification_level, availability_mode, distance_meters
  from ranked
  where distance_meters < 1e12
  order by distance_meters asc, provider_rating desc
  limit 50;
$$;

grant execute on function public.search_providers_geo to anon, authenticated, service_role;

-- Safe geography writes from Nest / PostgREST (avoids EWKT quirks on geography columns).
create or replace function public.replace_provider_service_areas(
  p_provider_id uuid,
  p_areas jsonb
)
returns setof public.provider_service_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  new_center geography(Point, 4326);
begin
  delete from public.provider_service_areas where provider_id = p_provider_id;

  for item in select * from jsonb_array_elements(coalesce(p_areas, '[]'::jsonb))
  loop
    if upper(item->>'type') = 'CITY' then
      if coalesce(item->>'cityName', '') = '' then
        raise exception 'cityName is required for CITY areas';
      end if;
      insert into public.provider_service_areas (provider_id, type, city_name)
      values (p_provider_id, 'CITY', item->>'cityName');
    elsif upper(item->>'type') = 'RADIUS' then
      new_center := ST_SetSRID(
        ST_MakePoint((item->>'lng')::double precision, (item->>'lat')::double precision),
        4326
      )::geography;
      insert into public.provider_service_areas (provider_id, type, center, radius_meters)
      values (p_provider_id, 'RADIUS', new_center, (item->>'radiusMeters')::integer);
    else
      raise exception 'Invalid service area type: %', item->>'type';
    end if;
  end loop;

  -- Prefer first RADIUS for profile.location; else first CITY centroid
  update public.profiles p
  set location = sa.center
  from (
    select center from public.provider_service_areas
    where provider_id = p_provider_id and type = 'RADIUS'
    order by created_at asc
    limit 1
  ) sa
  where p.id = p_provider_id and sa.center is not null;

  update public.profiles p
  set location = ac.location
  from public.provider_service_areas sa
  join public.area_centroids ac on ac.name = sa.city_name
  where p.id = p_provider_id
    and p.location is null
    and sa.provider_id = p_provider_id
    and sa.type = 'CITY';

  return query
    select * from public.provider_service_areas where provider_id = p_provider_id;
end;
$$;

grant execute on function public.replace_provider_service_areas to service_role, authenticated;
