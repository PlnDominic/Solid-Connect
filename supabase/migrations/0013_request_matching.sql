-- Phase D: request geography, opportunity matching, request-photo storage.

insert into storage.buckets (id, name, public) values ('request-photos', 'request-photos', true)
on conflict (id) do nothing;

do $$ begin
  create policy "customers upload request photos" on storage.objects for insert
    with check (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers delete their request photos" on storage.objects for delete
    using (bucket_id = 'request-photos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "request photos are publicly readable" on storage.objects for select
    using (bucket_id = 'request-photos');
exception when duplicate_object then null; end $$;

alter table public.service_requests
  add column if not exists location geography(Point, 4326);

alter table public.service_requests
  add column if not exists match_radius_meters integer not null default 10000;

alter table public.service_requests
  add column if not exists matched_at timestamptz;

update public.service_requests r
set location = a.location
from public.area_centroids a
where r.location is null
  and (
    r.location_label ilike a.name || '%'
    or r.location_label ilike '%' || a.name || '%'
  );

create table if not exists public.request_opportunities (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  score numeric not null default 0,
  distance_meters double precision,
  status text not null default 'NOTIFIED'
    check (status in ('NOTIFIED', 'VIEWED', 'DISMISSED', 'QUOTED')),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index if not exists request_opportunities_provider_idx
  on public.request_opportunities (provider_id, created_at desc);
create index if not exists request_opportunities_request_idx
  on public.request_opportunities (request_id);

alter table public.request_opportunities enable row level security;

do $$ begin
  create policy "providers read own opportunities"
    on public.request_opportunities for select
    using (
      auth.uid() = provider_id
      or exists (
        select 1 from public.service_requests r
        where r.id = request_id and r.customer_id = auth.uid()
      )
      or public.is_admin()
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers update own opportunity status"
    on public.request_opportunities for update
    using (auth.uid() = provider_id)
    with check (auth.uid() = provider_id);
exception when duplicate_object then null; end $$;

create or replace function public.match_providers_for_request(
  p_request_id uuid,
  p_limit integer default 20
)
returns table (
  provider_id uuid,
  score numeric,
  distance_meters double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with req as (
    select
      r.id,
      r.customer_id,
      r.category_id,
      r.category_label,
      r.match_radius_meters,
      coalesce(
        r.location,
        (
          select a.location from public.area_centroids a
          where r.location_label ilike '%' || a.name || '%'
          order by length(a.name) desc
          limit 1
        )
      ) as geom,
      lower(trim(split_part(r.category_label, '·', 1))) as trade
    from public.service_requests r
    where r.id = p_request_id
  ),
  candidates as (
    select
      p.id as pid,
      req.trade,
      req.geom,
      req.match_radius_meters,
      coalesce(p.provider_rating, 0) as rating,
      p.provider_certified,
      p.provider_verified,
      p.availability_mode,
      p.provider_category,
      (
        select min(hit.d) from (
          select ST_Distance(req.geom, sa.center) as d
          from public.provider_service_areas sa
          where sa.provider_id = p.id
            and sa.type = 'RADIUS'
            and sa.center is not null
            and req.geom is not null
            and ST_DWithin(req.geom, sa.center, sa.radius_meters)
          union all
          select ST_Distance(req.geom, ac.location) as d
          from public.provider_service_areas sa
          join public.area_centroids ac on ac.name = sa.city_name
          where sa.provider_id = p.id
            and sa.type = 'CITY'
            and req.geom is not null
            and ST_DWithin(req.geom, ac.location, req.match_radius_meters)
          union all
          select ST_Distance(req.geom, p.location) as d
          from (select 1) as _
          where p.location is not null
            and req.geom is not null
            and not exists (
              select 1 from public.provider_service_areas sa2 where sa2.provider_id = p.id
            )
            and ST_DWithin(req.geom, p.location, req.match_radius_meters)
        ) hit
      ) as dist_m
    from public.profiles p
    cross join req
    where p.role = 'provider'
      and p.id <> req.customer_id
      and p.availability_mode not in ('UNAVAILABLE', 'PAUSED')
      and (
        req.trade = ''
        or lower(coalesce(p.provider_category, '')) like '%' || req.trade || '%'
        or exists (
          select 1
          from public.provider_skills ps
          join public.skills s on s.id = ps.skill_id
          join public.categories c on c.id = s.category_id
          where ps.provider_id = p.id
            and (
              lower(c.name) like '%' || req.trade || '%'
              or (req.category_id is not null and s.category_id = req.category_id)
            )
        )
      )
  )
  select
    c.pid as provider_id,
    (
      case when lower(coalesce(c.provider_category, '')) like '%' || c.trade || '%' then 40 else 10 end
      + c.rating * 8
      + case when c.provider_certified then 10 when c.provider_verified then 5 else 0 end
      + case when c.availability_mode = 'AVAILABLE_NOW' then 15 else 0 end
      + greatest(0, 20 - coalesce(c.dist_m, 15000) / 1000.0)
    )::numeric as score,
    c.dist_m as distance_meters
  from candidates c
  where c.dist_m is not null
     or c.geom is null
  order by score desc, distance_meters asc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function public.match_providers_for_request to service_role, authenticated;

create or replace function public.set_request_location_from_label(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.service_requests r
  set location = a.location
  from public.area_centroids a
  where r.id = p_request_id
    and r.location is null
    and (
      r.location_label ilike a.name || '%'
      or r.location_label ilike '%' || a.name || '%'
    );
end;
$$;

grant execute on function public.set_request_location_from_label to service_role, authenticated;
