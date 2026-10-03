-- Provider-journey fixes.
--
-- 1. Quotes from providers who aren't verified were stamped "Identity
--    verified": the badge column only allowed 'certified' or 'verified', so
--    everyone who wasn't certified fell through to verified. Allow an honest
--    'unverified' badge.
-- 2. Customers no longer create payment rows themselves - accept_quote and
--    accept_direct_request (SECURITY DEFINER) do it. The leftover insert
--    policy from 0041 only let a customer add extra 'pending' rows to their
--    own job, which makes the API's one-payment-per-job lookup fail and can
--    wedge the job so the provider is never paid.

alter table public.quotes drop constraint if exists quotes_badge_kind_check;
alter table public.quotes
  add constraint quotes_badge_kind_check check (badge_kind in ('certified', 'verified', 'unverified'));

drop policy if exists "job customer opens a pending payment" on public.payments;
