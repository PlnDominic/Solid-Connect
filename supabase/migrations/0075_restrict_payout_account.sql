-- Payout accounts (a provider's MoMo / bank details) are no longer
-- readable by every signed-in user.
--
-- profiles is publicly readable, so until now anyone could read any
-- provider's payout_account through the API. Same approach as phone
-- (0073): app users lose SELECT on the column, and a provider reads their
-- own through my_payout_account(). Writing it is unchanged (a provider
-- still updates their own row). The service role - admin server actions
-- and the Nest API's payout code - keeps full access.
--
-- Requires 0073 (which switched profiles to per-column grants).

revoke select (payout_account) on public.profiles from anon, authenticated;

create or replace function public.my_payout_account()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select p.payout_account
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_payout_account() from public, anon;
grant execute on function public.my_payout_account() to authenticated;
