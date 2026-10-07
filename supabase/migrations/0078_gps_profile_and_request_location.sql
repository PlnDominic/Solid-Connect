-- Persist real GPS as PostGIS geography for profiles and requests.
--
-- Until now, profiles.area / service_requests.location_label were free text
-- and location geography was only filled by snapping to Accra area_centroids.
-- That breaks Ghana-wide use: Sapiman had no centroid → wrong match geom.
--
-- Best model:
--   * label  = human-readable place (reverse-geocode or typed)
--   * point  = exact GPS when the user located themselves (or chip centroid)
-- Matching already prefers request.location / profiles.location in PostGIS.

-- ── profile: area + optional GPS ───────────────────────────────────────
create or replace function public.set_own_profile_location(
  p_area text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_area text := nullif(trim(p_area), '');
  v_point geography(Point, 4326);
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_area is null then
    raise exception 'AREA_REQUIRED';
  end if;

  if p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  else
    -- Chip / typed Accra name: resolve to centroid when we know it.
    select a.location into v_point
    from public.area_centroids a
    where v_area ilike a.name
       or v_area ilike a.name || ',%'
       or v_area ilike '%' || a.name || '%'
    order by length(a.name) desc
    limit 1;
  end if;

  update public.profiles
  set area = v_area,
      location = coalesce(v_point, location)
  where id = auth.uid();
end;
$$;

revoke all on function public.set_own_profile_location(text, double precision, double precision) from public, anon;
grant execute on function public.set_own_profile_location(text, double precision, double precision) to authenticated;

-- ── request: prefer GPS over label centroid ──────────────────────────
create or replace function public.set_request_gps_location(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'COORDS_REQUIRED';
  end if;

  update public.service_requests r
  set location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  where r.id = p_request_id
    and (
      r.customer_id = auth.uid()
      or public.is_admin()
    );
end;
$$;

revoke all on function public.set_request_gps_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.set_request_gps_location(uuid, double precision, double precision) to authenticated, service_role;
