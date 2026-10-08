-- Jobs, quotes and requests: app users can no longer write them directly.
--
-- RLS decides WHICH ROWS a person can touch, not which columns. The old
-- policies let either party update any column of a job (status, step, price,
-- timestamps) through the public API, and let a customer insert a request
-- with any status or organization. Every real job and quote change already
-- goes through a SECURITY DEFINER function (accept_quote, start_job,
-- finish_job, cancel_job, revise_quote, counter_quote, respond_to_counter,
-- decline_quote, update_request, cancel_request ...) or the Nest API, and
-- those run as the table owner - so taking the direct write privileges away
-- changes nothing for them.
--
-- What the app still writes directly, and is therefore granted back:
--   quotes           - a provider's own new quote (src/api/requests.ts, used
--                      only when the API is not configured)
--   service_requests - a customer's new request (same fallback path)
-- Both are limited to the columns that code sends. status on a new quote
-- takes its default ('sent'), and a new request can only start in one of the
-- opening states and never inside an organization (those go through the API).
--
-- Reads are tightened separately in 0080.

-- Drop the old write policies, whatever they are called in this database, so
-- a stray permissive one (including the old "simulate button" exception)
-- cannot widen the new ones. The privileges revoked below already block these
-- writes; removing the policies as well means a future careless GRANT still
-- finds nothing that allows them (row-level security denies by default).
-- Then recreate exactly what is wanted.
--   jobs             - every write policy (nobody writes jobs directly)
--   quotes           - every insert/update/delete policy (a new one is added below)
--   service_requests - every insert/update/delete policy (a new one is added below)
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('jobs', 'quotes', 'service_requests')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

-- ── jobs: no direct writes at all ───────────────────────────────────────
revoke insert, update, delete on public.jobs from anon, authenticated;

-- ── quotes: a provider can add their own quote, nothing else ────────────
revoke insert, update, delete on public.quotes from anon, authenticated;

grant insert (
  request_id, provider_id, price, eta_label, badge_label, badge_kind, note,
  items, proposed_start
) on public.quotes to authenticated;

create policy "providers send their own quotes" on public.quotes
  for insert to authenticated
  with check (auth.uid() = provider_id);

-- ── service_requests: a customer can open their own request ─────────────
revoke insert, update, delete on public.service_requests from anon, authenticated;

grant insert (
  customer_id, category_id, category_label, description, photos, budget_min,
  budget_max, customer_budget, location_label, preferred_provider_id,
  preferred_time, urgency, request_mode, status
) on public.service_requests to authenticated;

create policy "customers create their own requests" on public.service_requests
  for insert to authenticated
  with check (
    auth.uid() = customer_id
    and status in ('open', 'matching', 'awaiting_provider')
  );
