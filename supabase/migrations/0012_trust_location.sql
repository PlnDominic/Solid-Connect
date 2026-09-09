-- Phase C: PostGIS service areas, availability, verification levels.
create extension if not exists postgis with schema extensions;

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
  add column if not exists verification_level text not null default 'REGISTERED';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_verification_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_verification_level_check
      check (verification_level in (
        'REGISTERED',
        'IDENTITY_VERIFIED',
        'PROFESSION_VERIFIED',
        'EXPERIENCE_VERIFIED',
        'SOLID_CONNECT_VERIFIED'
      ));
  end if;
end $$;

alter table public.profiles
  add column if not exists location geography(Point, 4326);

alter table public.profiles
  add column if not exists availability_mode text not null default 'SCHEDULE';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_availability_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_availability_mode_check
      check (availability_mode in ('AVAILABLE_NOW', 'UNAVAILABLE', 'SCHEDULE', 'PAUSED'));
  end if;
end $$;

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
  add column if not exists verification_type text not null default 'IDENTITY';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'provider_verifications_verification_type_check'
  ) then
    alter table public.provider_verifications
      add constraint provider_verifications_verification_type_check
      check (verification_type in ('IDENTITY', 'PROFESSION', 'EXPERIENCE', 'SOLID_CONNECT'));
  end if;
end $$;

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

do $$ begin
  create policy "area centroids readable" on public.area_centroids for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service areas readable" on public.provider_service_areas for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers manage own service areas" on public.provider_service_areas
    for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "availability readable" on public.provider_availability for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers manage own availability" on public.provider_availability
    for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "availability exceptions readable" on public.provider_availability_exceptions for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers manage own availability exceptions" on public.provider_availability_exceptions
    for all using (auth.uid() = provider_id) with check (auth.uid() = provider_id);
exception when duplicate_object then null; end $$;

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
set search_path = public, extensions
as $$
  with origin as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as geom
  ),
  ranked as (
    select
      p.*,
      (
        select min(d) from (
          select ST_Distance(o.geom, sa.center) as d
          from public.provider_service_areas sa
          where sa.provider_id = p.id
            and sa.type = 'RADIUS'
            and sa.center is not null
            and ST_DWithin(o.geom, sa.center, sa.radius_meters)
          union all
          select ST_Distance(o.geom, ac.location) as d
          from public.provider_service_areas sa
          join public.area_centroids ac on ac.name = sa.city_name
          where sa.provider_id = p.id
            and sa.type = 'CITY'
            and ST_DWithin(o.geom, ac.location, p_radius_meters)
          union all
          select ST_Distance(o.geom, p.location) as d
          where p.location is not null
            and not exists (select 1 from public.provider_service_areas sa2 where sa2.provider_id = p.id)
            and ST_DWithin(o.geom, p.location, p_radius_meters)
        ) hits
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
  where distance_meters is not null
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
set search_path = public, extensions
as $$
declare
  item jsonb;
  new_center geography;
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
