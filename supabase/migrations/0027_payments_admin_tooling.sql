-- Admin payments tooling: manual override/refund audit trail on payments,
-- and a platform-wide commission rate.

alter table public.payments
  add column if not exists refund_reason text;

alter table public.payments
  add column if not exists overridden_by uuid references public.admins(id);

alter table public.payments
  add column if not exists overridden_at timestamptz;

-- Singleton settings row - the `id boolean primary key default true check
-- (id)` trick guarantees at most one row can ever exist, so there's
-- always exactly one commission rate to read/update, never zero or many.
create table if not exists public.platform_config (
  id boolean primary key default true check (id),
  commission_percent numeric not null default 15,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admins(id)
);

insert into public.platform_config (id) values (true) on conflict (id) do nothing;

alter table public.platform_config enable row level security;

-- Admin-only for now (no mobile surface reads this yet); loosen to a
-- public-read policy later if a checkout screen needs to show the fee.
create policy "admins manage platform config" on public.platform_config
  for all using (public.is_admin()) with check (public.is_admin());
