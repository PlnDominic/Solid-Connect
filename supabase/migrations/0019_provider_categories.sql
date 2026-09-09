-- Providers can offer multiple service categories.

create table if not exists public.provider_categories (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (provider_id, category_id)
);

create index if not exists provider_categories_category_idx
  on public.provider_categories (category_id);

alter table public.provider_categories enable row level security;

do $$ begin
  create policy "provider_categories publicly readable"
    on public.provider_categories for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers manage own categories"
    on public.provider_categories for all
    using (auth.uid() = provider_id)
    with check (auth.uid() = provider_id);
exception when duplicate_object then null; end $$;

-- Backfill from profiles.provider_category (single name or "A · B" joined labels).
insert into public.provider_categories (provider_id, category_id, is_primary)
select p.id, c.id, true
from public.profiles p
join public.categories c
  on lower(c.name) = lower(trim(split_part(coalesce(p.provider_category, ''), '·', 1)))
  or lower(p.provider_category) = lower(c.name)
  or lower(p.provider_category) like '%' || lower(c.name) || '%'
where p.provider_category is not null
  and trim(p.provider_category) <> ''
on conflict (provider_id, category_id) do nothing;

-- Also attach General skills for backfilled categories.
insert into public.provider_skills (provider_id, skill_id, years_experience, verification_status)
select pc.provider_id, s.id, 0, 'UNVERIFIED'
from public.provider_categories pc
join public.skills s on s.category_id = pc.category_id and s.name = (
  select name from public.categories c where c.id = pc.category_id
) || ' · General'
on conflict (provider_id, skill_id) do nothing;

-- Fallback: skills named like category.default style already seeded as "<Category> · General"
insert into public.provider_skills (provider_id, skill_id, years_experience, verification_status)
select pc.provider_id, s.id, 0, 'UNVERIFIED'
from public.provider_categories pc
join public.skills s on s.category_id = pc.category_id
where not exists (
  select 1 from public.provider_skills ps
  where ps.provider_id = pc.provider_id and ps.skill_id = s.id
)
on conflict (provider_id, skill_id) do nothing;

create or replace function public.replace_provider_categories(
  p_provider_id uuid,
  p_category_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids text[];
  primary_id text;
  label text;
  skill_ids uuid[];
begin
  ids := array(
    select distinct x
    from unnest(coalesce(p_category_ids, '{}'::text[])) as x
    where x is not null and trim(x) <> ''
  );
  if coalesce(array_length(ids, 1), 0) < 1 then
    raise exception 'CATEGORIES_REQUIRED';
  end if;

  if exists (
    select 1 from unnest(ids) as cid
    where not exists (select 1 from public.categories c where c.id = cid)
  ) then
    raise exception 'UNKNOWN_CATEGORY';
  end if;

  delete from public.provider_categories where provider_id = p_provider_id;

  primary_id := ids[1];
  insert into public.provider_categories (provider_id, category_id, is_primary)
  select p_provider_id, cid, (cid = primary_id)
  from unnest(ids) as cid;

  select string_agg(c.name, ' · ' order by array_position(ids, c.id))
  into label
  from public.categories c
  where c.id = any (ids);

  update public.profiles
  set provider_category = label
  where id = p_provider_id;

  -- Replace skills with the General skill for each selected category.
  select coalesce(array_agg(s.id), '{}'::uuid[])
  into skill_ids
  from public.skills s
  where s.category_id = any (ids);

  delete from public.provider_skills
  where provider_id = p_provider_id
    and skill_id not in (select unnest(skill_ids));

  insert into public.provider_skills (provider_id, skill_id, years_experience, verification_status, updated_at)
  select p_provider_id, sid, 0, 'UNVERIFIED', now()
  from unnest(skill_ids) as sid
  on conflict (provider_id, skill_id) do update
    set updated_at = now();

  return jsonb_build_object(
    'categoryIds', to_jsonb(ids),
    'label', label,
    'skillCount', coalesce(array_length(skill_ids, 1), 0)
  );
end;
$$;

grant execute on function public.replace_provider_categories to service_role, authenticated;

-- Browse/geo search: match primary label OR any linked category.
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
security definer
set search_path = public, extensions
as $$
  with origin as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as geom
  ),
  ranked as (
    select
      p.id,
      p.full_name,
      p.initials,
      p.area,
      p.photo_url,
      p.tagline,
      p.provider_category,
      p.provider_rating,
      p.provider_jobs_count,
      p.provider_verified,
      p.provider_certified,
      p.verification_level::text,
      p.availability_mode::text,
      (
        select min(d)
        from (
          select ST_Distance(o.geom, sa.center) as d
          from public.provider_service_areas sa
          where sa.provider_id = p.id
            and sa.type = 'RADIUS'
            and sa.center is not null
            and ST_DWithin(o.geom, sa.center, coalesce(sa.radius_meters, p_radius_meters))
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
      and (
        p_category is null
        or p.provider_category ilike '%' || p_category || '%'
        or exists (
          select 1
          from public.provider_categories pc
          join public.categories c on c.id = pc.category_id
          where pc.provider_id = p.id
            and (
              c.name ilike p_category
              or c.id = lower(replace(p_category, ' ', '_'))
              or c.name ilike '%' || p_category || '%'
            )
        )
      )
      and (
        p_min_verification is null
        or p.verification_level::text = p_min_verification
        or (p_min_verification = 'IDENTITY_VERIFIED' and p.verification_level::text in (
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
