-- Provider subscriptions (Hubtel).
--
-- A provider's first accepted job is free. After that they need an active
-- yearly subscription to send quotes or accept direct requests. Subscriptions
-- are one-off Hubtel checkouts (Hubtel Checkout has no auto-debit), so each
-- paid row buys a fixed period and renewing just stacks a new period on top.
--
-- Only the Nest API (service role) writes this table. Providers can read
-- their own rows.

create table if not exists public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  period_days integer not null check (period_days > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  client_reference text unique,
  checkout_url text,
  gateway_transaction_id text,
  channel text,
  paid_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists provider_subscriptions_provider_idx
  on public.provider_subscriptions(provider_id, status, expires_at desc);

alter table public.provider_subscriptions enable row level security;

revoke all on public.provider_subscriptions from anon, authenticated;
grant select on public.provider_subscriptions to authenticated;

drop policy if exists "providers read their own subscriptions" on public.provider_subscriptions;
create policy "providers read their own subscriptions" on public.provider_subscriptions
  for select to authenticated
  using (auth.uid() = provider_id);

-- Latest paid expiry for a provider (null when they never subscribed).
create or replace function public.provider_subscription_expiry(p_provider_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(expires_at)
  from public.provider_subscriptions
  where provider_id = p_provider_id and status = 'paid';
$$;

-- Free trial = the provider's first accepted job. Cancelled jobs don't use it up.
create or replace function public.provider_trial_used(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.jobs
    where provider_id = p_provider_id and status <> 'cancelled'
  );
$$;

revoke execute on function public.provider_subscription_expiry(uuid) from public, anon, authenticated;
revoke execute on function public.provider_trial_used(uuid) from public, anon, authenticated;
grant execute on function public.provider_subscription_expiry(uuid) to service_role;
grant execute on function public.provider_trial_used(uuid) to service_role;
