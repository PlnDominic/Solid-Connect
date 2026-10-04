-- Live map presence for providers who are "Available now". One row per
-- provider, upserted in place (only the latest position matters, the same
-- shape as job_locations in 0024).
--
-- Privacy: this table never holds a provider's exact position. Every write
-- goes through report_provider_presence, which snaps the fix to a ~450 m
-- grid before storing it, so the public map can't be used to find where a
-- provider lives or to follow them. The exact position is still shared
-- with the customer who hired them, during the job, via job_locations.

create table if not exists public.provider_presence (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create index if not exists provider_presence_updated_at_idx on public.provider_presence (updated_at);

alter table public.provider_presence enable row level security;

-- No select/insert/update/delete policies: reads go through map_providers
-- and writes through report_provider_presence, both security definer with
-- their own checks (the same pattern as job_locations' writes).

-- Grid size in degrees. 0.004 deg is ~445 m north-south at Accra's latitude.
create or replace function public.presence_grid(p_value double precision)
returns double precision
language sql
immutable
as $$
  select round(p_value / 0.004) * 0.004;
$$;

-- Called by the provider's phone while the app is open. Returns true when
-- the provider is now visible on the map, false (and clears any old row)
-- when they aren't eligible - not a provider, not "Available now", or
-- suspended - so the phone can stop sending.
create or replace function public.report_provider_presence(
  p_lat double precision,
  p_lng double precision
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_POSITION';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if not found
    or me.role <> 'provider'
    or me.availability_mode is distinct from 'AVAILABLE_NOW'
    or me.suspended_at is not null
  then
    delete from public.provider_presence where provider_id = auth.uid();
    return false;
  end if;

  insert into public.provider_presence (provider_id, lat, lng, updated_at)
  values (auth.uid(), public.presence_grid(p_lat), public.presence_grid(p_lng), now())
  on conflict (provider_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    updated_at = excluded.updated_at;
  return true;
end;
$$;

-- Lets a provider drop off the map straight away (going unavailable,
-- signing out) instead of waiting for their row to go stale.
create or replace function public.clear_provider_presence()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.provider_presence where provider_id = auth.uid();
$$;

-- Providers to draw on the map inside a bounding box: only those still
-- "Available now", not suspended, not blocked either way with the viewer,
-- and seen in the last 10 minutes. Coordinates are the stored grid point.
create or replace function public.map_providers(
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
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.initials,
    p.photo_url,
    p.provider_category,
    coalesce(p.provider_rating, 0)::numeric,
    coalesce(p.provider_jobs_count, 0)::integer,
    coalesce(p.provider_verified, false),
    p.verification_level::text,
    pp.lat,
    pp.lng,
    pp.updated_at
  from public.provider_presence pp
  join public.profiles p on p.id = pp.provider_id
  where auth.uid() is not null
    and p.role = 'provider'
    and p.availability_mode = 'AVAILABLE_NOW'
    and p.suspended_at is null
    and p.id <> auth.uid()
    and pp.updated_at > now() - interval '10 minutes'
    and pp.lat between least(p_min_lat, p_max_lat) and greatest(p_min_lat, p_max_lat)
    and pp.lng between least(p_min_lng, p_max_lng) and greatest(p_min_lng, p_max_lng)
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
  order by pp.updated_at desc
  limit 200;
$$;

revoke all on function public.report_provider_presence(double precision, double precision) from public, anon;
revoke all on function public.clear_provider_presence() from public, anon;
revoke all on function public.map_providers(double precision, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.report_provider_presence(double precision, double precision) to authenticated;
grant execute on function public.clear_provider_presence() to authenticated;
grant execute on function public.map_providers(double precision, double precision, double precision, double precision, text) to authenticated;

-- Rows for providers who went quiet are harmless (map_providers ignores
-- them) but there's no reason to keep a position around for a day.
create or replace function public.prune_provider_presence()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.provider_presence where updated_at < now() - interval '1 hour';
$$;

revoke all on function public.prune_provider_presence() from public, anon, authenticated;

-- pg_cron has been enabled since 0036.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'prune-provider-presence') then
    perform cron.schedule('prune-provider-presence', '*/30 * * * *', 'select public.prune_provider_presence()');
  end if;
end;
$$;
