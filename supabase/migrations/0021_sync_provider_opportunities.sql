-- When a provider adds services after a request was already matched,
-- they would otherwise never appear in request_opportunities / feed.
-- This upserts opportunities for open marketplace requests that match them.

create or replace function public.sync_provider_opportunities(p_provider_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  m record;
  n integer := 0;
begin
  if p_provider_id is null then
    return 0;
  end if;

  for r in
    select sr.id
    from public.service_requests sr
    where sr.status in ('open', 'matching', 'quoted')
      and coalesce(sr.request_mode, 'GENERAL') <> 'DIRECT'
      and sr.preferred_provider_id is null
      and exists (
        select 1
        from public.provider_categories pc
        left join public.categories c on c.id = pc.category_id
        where pc.provider_id = p_provider_id
          and (
            pc.category_id = sr.category_id
            or (
              c.name is not null
              and lower(coalesce(sr.category_label, '')) like '%' || lower(c.name) || '%'
            )
          )
      )
  loop
    select mp.provider_id, mp.score, mp.distance_meters
      into m
    from public.match_providers_for_request(r.id, 50) mp
    where mp.provider_id = p_provider_id
    limit 1;

    if found then
      insert into public.request_opportunities (
        request_id, provider_id, score, distance_meters, status
      )
      values (
        r.id, m.provider_id, m.score, m.distance_meters, 'NOTIFIED'
      )
      on conflict (request_id, provider_id) do update
        set score = excluded.score,
            distance_meters = excluded.distance_meters
      where request_opportunities.status <> 'DISMISSED';
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

grant execute on function public.sync_provider_opportunities(uuid) to service_role, authenticated;
