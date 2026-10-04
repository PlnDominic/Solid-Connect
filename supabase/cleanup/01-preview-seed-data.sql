-- Solid Connect - PREVIEW seed/demo data removal (read-only)
--
-- Run this first, in the Supabase SQL editor, against production. It
-- changes nothing. It lists the demo accounts that
-- 02-remove-seed-data.sql will delete and counts what hangs off them,
-- and flags anything that ties a REAL user to a demo account.
--
-- "Seed account" = a profile with is_seed = true, or an auth user on the
-- @solidconnect.test test domain (created by the old, now-removed seed-test-users script), EXCEPT
-- anyone in public.admins - admin logins are always kept.
--
-- Categories and skills are real reference data and are never touched.

with seed_ids as (
  select p.id from public.profiles p where p.is_seed = true
  union
  select u.id from auth.users u where u.email ilike '%@solidconnect.test'
  except
  select a.id from public.admins a
)
select 'accounts to delete' as what, p.id::text as id, p.full_name as detail,
       coalesce(u.email, '(no login)') as extra
from seed_ids s
left join public.profiles p on p.id = s.id
left join auth.users u on u.id = s.id
order by 3;

-- Counts of demo rows that will go, and the blockers (must all be 0).
with seed_ids as (
  select p.id from public.profiles p where p.is_seed = true
  union
  select u.id from auth.users u where u.email ilike '%@solidconnect.test'
  except
  select a.id from public.admins a
)
select * from (values
  ('demo requests',                (select count(*) from public.service_requests where customer_id in (select id from seed_ids))),
  ('demo quotes (any request)',    (select count(*) from public.quotes where provider_id in (select id from seed_ids))),
  ('demo-only jobs',               (select count(*) from public.jobs where customer_id in (select id from seed_ids) and provider_id in (select id from seed_ids))),
  ('chat threads with a demo user',(select count(*) from public.chat_threads where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids))),
  ('saved demo providers',         (select count(*) from public.saved_providers where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids))),
  ('demo portfolio photos',        (select count(*) from public.provider_portfolio_photos where provider_id in (select id from seed_ids))),
  -- BLOCKERS: real users with jobs, disputes, payouts or organizations
  -- involving a demo account. 02 refuses to run unless all are 0.
  ('BLOCKER: real-user jobs with a demo account',
     (select count(*) from public.jobs
       where (customer_id in (select id from seed_ids)) <> (provider_id in (select id from seed_ids)))),
  ('BLOCKER: real-user disputes with a demo account',
     (select count(*) from public.disputes
       where (customer_id in (select id from seed_ids)) <> (provider_id in (select id from seed_ids)))),
  ('BLOCKER: real members in demo-owned organizations',
     (select count(*) from public.organization_members m
       join public.organizations o on o.id = m.organization_id
       where o.owner_id in (select id from seed_ids) and m.profile_id not in (select id from seed_ids)))
) as t(what, how_many);
