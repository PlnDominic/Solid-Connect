-- Solid Connect - the other half of item 12 ("Job request editing... before
-- match"): 0033 added cancellation; this adds editing.
--
-- The existing "customers update their own requests" RLS policy
-- (0001_init.sql) is actually unrestricted - any customer can already
-- update any column on any of their own requests via a direct Supabase
-- .update(), regardless of status, with nothing enforcing "only before a
-- provider has quoted." Rather than lean on a well-behaved client to
-- respect that boundary, this adds a security-definer RPC that enforces
-- it server-side, the same choice already made for cancel_request in
-- 0033 and reject_direct_request/accept_direct_request before that.
--
-- Editing is narrower than cancelling: only 'open' or 'matching' (not
-- 'quoted' or 'awaiting_provider') - a provider may have already priced
-- the job against the original description/budget/location, and letting
-- the customer change those out from under an existing quote would be
-- misleading. category_id/category_label are deliberately not
-- parameters here at all: changing trade entirely is a new request, not
-- an edit of this one.
create or replace function public.update_request(
  p_request_id uuid,
  p_customer_id uuid,
  p_description text,
  p_budget_min integer,
  p_budget_max integer,
  p_customer_budget integer,
  p_location_label text,
  p_photos text[]
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.service_requests%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into r from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.customer_id <> p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if r.status not in ('open', 'matching') then
    raise exception 'REQUEST_NOT_EDITABLE';
  end if;

  update public.service_requests
  set
    description = coalesce(nullif(trim(p_description), ''), description),
    budget_min = p_budget_min,
    budget_max = p_budget_max,
    customer_budget = p_customer_budget,
    location_label = coalesce(nullif(trim(p_location_label), ''), location_label),
    photos = coalesce(p_photos, photos)
  where id = p_request_id
  returning * into r;

  return r;
end;
$$;

revoke all on function public.update_request(uuid, uuid, text, integer, integer, integer, text, text[]) from public;
grant execute on function public.update_request(uuid, uuid, text, integer, integer, integer, text, text[]) to service_role, authenticated;
