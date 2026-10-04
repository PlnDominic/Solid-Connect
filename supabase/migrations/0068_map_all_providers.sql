-- Show every active provider on the customer map, not only live ones.
--
-- 0067 only returned providers who were "Available now" AND had the app
-- open in the last 10 minutes. New providers start on SCHEDULE, so in
-- practice the map was empty. Now:
--   * live providers (fresh presence, Available now) keep their ~450 m
--     grid point and are flagged is_live = true;
--   * every other active provider (SCHEDULE or AVAILABLE_NOW without a
--     fresh fix) is placed at their AREA - the neighbourhood centroid that
--     matches profiles.area, else their first service area, else their
--     saved location snapped to the same ~450 m grid. Never an exact spot.
--   * UNAVAILABLE / PAUSED / suspended providers stay hidden, as before.
--
-- Also adds more Accra neighbourhoods to area_centroids so free-text areas
-- such as "Labadi" can be placed. Coordinates are approximate
-- neighbourhood centres, which is all the map needs.

insert into public.area_centroids (name, location) values
  ('Labadi',        ST_SetSRID(ST_MakePoint(-0.150, 5.560), 4326)::geography),
  ('Labone',        ST_SetSRID(ST_MakePoint(-0.170, 5.565), 4326)::geography),
  ('East Legon',    ST_SetSRID(ST_MakePoint(-0.160, 5.635), 4326)::geography),
  ('Madina',        ST_SetSRID(ST_MakePoint(-0.166, 5.683), 4326)::geography),
  ('Adenta',        ST_SetSRID(ST_MakePoint(-0.168, 5.705), 4326)::geography),
  ('Haatso',        ST_SetSRID(ST_MakePoint(-0.205, 5.666), 4326)::geography),
  ('Dome',          ST_SetSRID(ST_MakePoint(-0.235, 5.650), 4326)::geography),
  ('Kwabenya',      ST_SetSRID(ST_MakePoint(-0.229, 5.680), 4326)::geography),
  ('Dzorwulu',      ST_SetSRID(ST_MakePoint(-0.200, 5.610), 4326)::geography),
  ('Roman Ridge',   ST_SetSRID(ST_MakePoint(-0.192, 5.602), 4326)::geography),
  ('Tesano',        ST_SetSRID(ST_MakePoint(-0.228, 5.598), 4326)::geography),
  ('Abeka',         ST_SetSRID(ST_MakePoint(-0.234, 5.598), 4326)::geography),
  ('Lapaz',         ST_SetSRID(ST_MakePoint(-0.252, 5.606), 4326)::geography),
  ('Kaneshie',      ST_SetSRID(ST_MakePoint(-0.236, 5.567), 4326)::geography),
  ('Kokomlemle',    ST_SetSRID(ST_MakePoint(-0.208, 5.574), 4326)::geography),
  ('Adabraka',      ST_SetSRID(ST_MakePoint(-0.208, 5.560), 4326)::geography),
  ('Ridge',         ST_SetSRID(ST_MakePoint(-0.197, 5.565), 4326)::geography),
  ('Accra Central', ST_SetSRID(ST_MakePoint(-0.205, 5.550), 4326)::geography),
  ('Teshie',        ST_SetSRID(ST_MakePoint(-0.107, 5.583), 4326)::geography),
  ('Nungua',        ST_SetSRID(ST_MakePoint(-0.079, 5.600), 4326)::geography),
  ('Sakumono',      ST_SetSRID(ST_MakePoint(-0.062, 5.618), 4326)::geography),
  ('Ashaiman',      ST_SetSRID(ST_MakePoint(-0.033, 5.694), 4326)::geography),
  ('Weija',         ST_SetSRID(ST_MakePoint(-0.336, 5.556), 4326)::geography),
  ('Kasoa',         ST_SetSRID(ST_MakePoint(-0.425, 5.534), 4326)::geography)
on conflict (name) do nothing;

-- The return type changes (is_live, area_label), so drop and recreate.
drop function if exists public.map_providers(double precision, double precision, double precision, double precision, text);

create function public.map_providers(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_category text default null
)
returns table (
  id uuid,
  full_name text,
  initials text,
  photo_url text,
  provider_category text,
  provider_rating numeric,
  provider_jobs_count integer,
  provider_verified boolean,
  verification_level text,
  lat double precision,
  lng double precision,
  updated_at timestamptz,
  is_live boolean,
  area_label text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select p.*
    from public.profiles p
    where auth.uid() is not null
      and p.role = 'provider'
      and p.suspended_at is null
      and p.availability_mode in ('AVAILABLE_NOW', 'SCHEDULE')
      and p.id <> auth.uid()
      and not public.is_blocked_between(auth.uid(), p.id)
      and (
        p_category is null
        or trim(p_category) = ''
        or lower(coalesce(p.provider_category, '')) like '%' || lower(trim(p_category)) || '%'
        or exists (
          select 1
          from public.provider_categories pc
          join public.categories c on c.id = pc.category_id
          where pc.provider_id = p.id
            and lower(c.name) = lower(trim(p_category))
        )
      )
  ),
  placed as (
    select
      c.id,
      c.full_name,
      c.initials,
      c.photo_url,
      c.provider_category,
      coalesce(c.provider_rating, 0)::numeric as provider_rating,
      coalesce(c.provider_jobs_count, 0)::integer as provider_jobs_count,
      coalesce(c.provider_verified, false) as provider_verified,
      c.verification_level::text as verification_level,
      (live.provider_id is not null) as is_live,
      live.updated_at,
      case
        when live.provider_id is not null then live.lat
        when ac.location is not null then ST_Y(ac.location::geometry)
        else public.presence_grid(ST_Y(coalesce(sa.loc, c.location)::geometry))
      end as lat,
      case
        when live.provider_id is not null then live.lng
        when ac.location is not null then ST_X(ac.location::geometry)
        else public.presence_grid(ST_X(coalesce(sa.loc, c.location)::geometry))
      end as lng,
      coalesce(ac.name, sa.city_name, split_part(c.area, ',', 1)) as area_label
    from candidates c
    -- Live: Available now with a fix from the last 10 minutes.
    left join public.provider_presence live
      on live.provider_id = c.id
     and c.availability_mode = 'AVAILABLE_NOW'
     and live.updated_at > now() - interval '10 minutes'
    -- Area centroid named in profiles.area; the longest name wins so
    -- "Roman Ridge" beats "Ridge".
    left join lateral (
      select a.name, a.location
      from public.area_centroids a
      where c.area ilike '%' || a.name || '%'
      order by length(a.name) desc
      limit 1
    ) ac on true
    -- Fallback: the provider's first service area.
    left join lateral (
      select coalesce(city.location, s.center) as loc, s.city_name
      from public.provider_service_areas s
      left join public.area_centroids city on city.name = s.city_name
      where s.provider_id = c.id
      order by s.created_at
      limit 1
    ) sa on true
  )
  select
    id, full_name, initials, photo_url, provider_category, provider_rating,
    provider_jobs_count, provider_verified, verification_level,
    lat, lng, updated_at, is_live, area_label
  from placed
  where lat is not null
    and lng is not null
    and lat between least(p_min_lat, p_max_lat) and greatest(p_min_lat, p_max_lat)
    and lng between least(p_min_lng, p_max_lng) and greatest(p_min_lng, p_max_lng)
  order by is_live desc, provider_rating desc
  limit 200;
$$;

revoke all on function public.map_providers(double precision, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.map_providers(double precision, double precision, double precision, double precision, text) to authenticated;
