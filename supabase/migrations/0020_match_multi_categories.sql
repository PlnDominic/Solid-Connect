-- Prefer provider_categories (multi-service) when matching requests to providers.

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
      req.category_id,
      req.geom,
      req.match_radius_meters,
      coalesce(p.provider_rating, 0) as rating,
      p.provider_certified,
      p.provider_verified,
      p.availability_mode,
      p.provider_category,
      exists (
        select 1
        from public.provider_categories pc
        where pc.provider_id = p.id
          and (
            (req.category_id is not null and pc.category_id = req.category_id)
            or exists (
              select 1 from public.categories c
              where c.id = pc.category_id
                and lower(c.name) like '%' || req.trade || '%'
            )
          )
      ) as category_hit,
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
          from public.provider_categories pc
          where pc.provider_id = p.id
            and (
              (req.category_id is not null and pc.category_id = req.category_id)
              or exists (
                select 1 from public.categories c
                where c.id = pc.category_id
                  and lower(c.name) like '%' || req.trade || '%'
              )
            )
        )
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
      case
        when c.category_hit then 40
        when lower(coalesce(c.provider_category, '')) like '%' || c.trade || '%' then 40
        else 10
      end
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
