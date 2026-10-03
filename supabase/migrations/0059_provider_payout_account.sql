-- Migration 0059: Provider payout destination account
-- Stores the provider's preferred Mobile Money or bank account configuration
-- for receiving job payouts net of platform commission.

alter table public.profiles
  add column if not exists payout_account jsonb;

comment on column public.profiles.payout_account is
  'Provider payout destination details (MoMo network + phone + account name, or Bank name + account number + account name)';
