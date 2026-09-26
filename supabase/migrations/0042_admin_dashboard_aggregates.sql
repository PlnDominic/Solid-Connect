-- The admin dashboard used to download whole payments, profiles and
-- service_requests tables just to sum and count them in Node. These
-- functions do that aggregation in Postgres so the dashboard stays fast
-- as data grows. They are called only with the service role (the admin
-- app's server client), never from the mobile app.

create or replace function public.admin_dashboard_money(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'released_total', coalesce(sum(amount) filter (where status in ('released', 'completed', 'paid')), 0),
    'pending_total', coalesce(sum(amount) filter (where status in ('pending', 'held', 'escrow')), 0),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', m, 'amount', s) order by m)
      from (
        select to_char(date_trunc('month', created_at at time zone 'utc'), 'YYYY-MM') as m, sum(amount) as s
        from public.payments
        where status in ('released', 'completed', 'paid') and created_at >= p_since
        group by 1
      ) t
    ), '[]'::jsonb)
  )
  from public.payments;
$$;

create or replace function public.admin_area_coverage()
returns table (area text, supply bigint, demand bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name as area,
    (select count(*) from public.profiles p
       where p.role = 'provider' and starts_with(lower(coalesce(p.area, '')), lower(c.name))) as supply,
    (select count(*) from public.service_requests r
       where starts_with(lower(coalesce(r.location_label, '')), lower(c.name))) as demand
  from public.area_centroids c;
$$;

revoke all on function public.admin_dashboard_money(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_area_coverage() from public, anon, authenticated;
grant execute on function public.admin_dashboard_money(timestamptz) to service_role;
grant execute on function public.admin_area_coverage() to service_role;
