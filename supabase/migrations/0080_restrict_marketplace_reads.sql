-- Requests, quotes, jobs and saved providers: readable only by the people
-- involved.
--
-- These four tables were created with "for select using (true)" (0001) and
-- no role, so anyone holding the public anon key - signed in or not - could
-- read every customer's request text, photos, neighbourhood and budget, every
-- quote price, every job and who hired whom. (payments were fixed in 0041.)
--
-- Who can read what now:
--   service_requests - the customer; the provider it was sent to directly;
--                      providers matched to it (request_opportunities),
--                      who have quoted on it, or who have a job on it; other
--                      members of the customer's organization; admins
--   quotes           - the provider who wrote it; the request's customer or
--                      organization members; admins. Competing providers no
--                      longer see each other's prices.
--   jobs             - the customer and provider; the request's organization
--                      members; admins
--   saved_providers  - the customer who saved them; admins
-- Nothing is readable while signed out.
--
-- The Nest API and the admin site's service-role client are unaffected. The
-- admin pages that read through the signed-in admin's own session keep
-- working because every policy includes is_admin().
--
-- The lookups live in SECURITY DEFINER functions (like is_admin()) so a
-- policy on one table can consult another without re-triggering that table's
-- own policies, which would otherwise recurse.

-- Is the caller the customer behind this request (or in their organization)?
create or replace function public.is_request_owner(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.service_requests r
      where r.id = p_request_id
        and (
          r.customer_id = auth.uid()
          or (
            r.organization_id is not null
            and exists (
              select 1 from public.organization_members m
              where m.organization_id = r.organization_id
                and m.profile_id = auth.uid()
            )
          )
        )
    );
$$;

-- May the caller see this request at all?
create or replace function public.can_view_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or public.is_request_owner(p_request_id)
      or exists (
        select 1 from public.service_requests r
        where r.id = p_request_id and r.preferred_provider_id = auth.uid()
      )
      or exists (
        select 1 from public.request_opportunities o
        where o.request_id = p_request_id and o.provider_id = auth.uid()
      )
      or exists (
        select 1 from public.quotes q
        where q.request_id = p_request_id and q.provider_id = auth.uid()
      )
      or exists (
        select 1 from public.jobs j
        where j.request_id = p_request_id
          and (j.provider_id = auth.uid() or j.customer_id = auth.uid())
      )
    );
$$;

revoke all on function public.is_request_owner(uuid) from public, anon;
revoke all on function public.can_view_request(uuid) from public, anon;
grant execute on function public.is_request_owner(uuid) to authenticated, service_role;
grant execute on function public.can_view_request(uuid) to authenticated, service_role;

-- Replace every existing SELECT policy on the four tables (whatever it is
-- called in this database) with the narrow ones below.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('service_requests', 'quotes', 'jobs', 'saved_providers')
      and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

create policy "request parties read requests" on public.service_requests
  for select to authenticated
  using (customer_id = auth.uid() or public.can_view_request(id));

create policy "quote parties read quotes" on public.quotes
  for select to authenticated
  using (
    provider_id = auth.uid()
    or public.is_admin()
    or public.is_request_owner(request_id)
  );

create policy "job parties read jobs" on public.jobs
  for select to authenticated
  using (
    customer_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin()
    or public.is_request_owner(request_id)
  );

create policy "customers read their saved providers" on public.saved_providers
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

-- Signed-out callers get no access to these tables at all.
revoke select on public.service_requests, public.quotes, public.jobs, public.saved_providers from anon;
