-- Solid Connect - three more from the "20 more things" list:
--  11. Provider decline tracking for GENERAL feed opportunities (DIRECT
--      request rejection already recorded a reason - service_requests.
--      rejection_reason, 0017/0022 - but a provider passing on a
--      general/broadcast opportunity had no way to record why, and
--      nothing surfaced either kind of decline in the admin panel).
--  12. Saved locations ("address book") - AreaPicker (src/components/
--      AreaPicker.tsx) only ever offered the fixed Accra neighborhood
--      grid; a repeat customer re-picked the same one or two areas on
--      every request with no way to save a shortcut.
--  17. Partial refunds - docs/legal/refund-dispute-policy.md §4 flagged
--      this explicitly as unsupported ("a payment is refunded or
--      released, not split").

-- ── 11. Decline tracking ────────────────────────────────────────────────
alter table public.request_opportunities
  add column if not exists dismiss_reason text;

-- No INSERT policy exists on request_opportunities for providers (rows
-- are normally created by the match/sync RPCs) - so a provider dismissing
-- a general opportunity that has no row yet (the mobile Supabase-direct
-- fallback path doesn't always have one) needs a security-definer path
-- that can insert-or-update either way, same shape as accept_direct_
-- request / reject_direct_request already use for the DIRECT case.
create or replace function public.dismiss_opportunity(
  p_request_id uuid,
  p_provider_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.request_opportunities (request_id, provider_id, status, dismiss_reason)
  values (p_request_id, p_provider_id, 'DISMISSED', nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (request_id, provider_id)
  do update set status = 'DISMISSED', dismiss_reason = excluded.dismiss_reason;
end;
$$;

revoke all on function public.dismiss_opportunity(uuid, uuid, text) from public;
grant execute on function public.dismiss_opportunity(uuid, uuid, text) to service_role, authenticated;

-- ── 12. Saved locations ─────────────────────────────────────────────────
create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  area text not null,
  created_at timestamptz not null default now(),
  unique (user_id, area)
);

create index if not exists saved_locations_user_idx
  on public.saved_locations (user_id, created_at desc);

alter table public.saved_locations enable row level security;

do $$ begin
  create policy "users manage own saved locations" on public.saved_locations for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── 17. Partial refunds ─────────────────────────────────────────────────
alter table public.payments
  add column if not exists refund_amount integer;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'released', 'refunded', 'partially_refunded'));
