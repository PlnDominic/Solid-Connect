-- Two more owner-editable platform settings on the existing singleton
-- config row (0027_payments_admin_tooling.sql), same pattern as
-- commission_percent: read on the Settings page, written by
-- updatePlatformSettings (owner-only, settings/actions.ts).

alter table public.platform_config
  add column if not exists support_email text not null default 'support@solidconnect.co';

-- Nullable on purpose: null means "no default", so the payout method
-- select on /payouts keeps its current blank/required behaviour until an
-- owner actually sets one.
alter table public.platform_config
  add column if not exists default_payout_method text;
