-- Solid Connect - REMOVE seed/demo data from production
--
-- Run 01-preview-seed-data.sql first and check its output. Then run this
-- whole file in one go in the Supabase SQL editor. It is one transaction:
-- if any guard below fails, nothing is deleted.
--
-- Deletes every seed account (profiles with is_seed = true, and
-- @solidconnect.test test logins) and everything that belongs only to
-- them: their requests, quotes, demo-only jobs and payments, chats,
-- reviews, photos and logins. Admin logins (public.admins) are kept.
-- Categories and skills are untouched.
--
-- It also removes the "simulate button" exception from the quotes insert
-- policy, which let any client post a quote on behalf of a seed provider.

begin;

create temp table seed_ids on commit drop as
  select p.id from public.profiles p where p.is_seed = true
  union
  select u.id from auth.users u where u.email ilike '%@solidconnect.test'
  except
  select a.id from public.admins a;

-- Jobs where BOTH sides are demo accounts - fake jobs, safe to remove.
create temp table seed_jobs on commit drop as
  select j.id from public.jobs j
  where j.customer_id in (select id from seed_ids)
    and j.provider_id in (select id from seed_ids);

-- ── Guards: never delete a real user's job, dispute or organization ─────
do $$
declare
  mixed_jobs int;
  mixed_disputes int;
  real_members int;
begin
  select count(*) into mixed_jobs from public.jobs
   where (customer_id in (select id from seed_ids)) <> (provider_id in (select id from seed_ids));
  select count(*) into mixed_disputes from public.disputes
   where (customer_id in (select id from seed_ids)) <> (provider_id in (select id from seed_ids));
  select count(*) into real_members from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where o.owner_id in (select id from seed_ids) and m.profile_id not in (select id from seed_ids);
  if mixed_jobs + mixed_disputes + real_members > 0 then
    raise exception
      'Stopped, nothing deleted: % job(s), % dispute(s), % org member(s) link a real user to a demo account. Decide how to handle those first.',
      mixed_jobs, mixed_disputes, real_members;
  end if;
end $$;

-- ── Rows hanging off demo-only jobs (no cascade on these) ───────────────
delete from public.referrals    where job_id in (select id from seed_jobs);
delete from public.chat_threads where job_id in (select id from seed_jobs);   -- chat_messages cascade
-- payments (+ provider_payouts), reviews, customer_reviews, disputes
-- (+ evidence), job_events, job_locations and job_reschedules cascade
-- from jobs; payouts tied directly to a demo provider go explicitly.
delete from public.provider_payouts where provider_id in (select id from seed_ids);
delete from public.dispute_evidence where author_id in (select id from seed_ids);
delete from public.disputes         where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids);
delete from public.reviews          where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids);
delete from public.customer_reviews where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids);
delete from public.job_events       where actor_id in (select id from seed_ids);
delete from public.job_reschedules  where proposed_by in (select id from seed_ids);
delete from public.jobs             where id in (select id from seed_jobs);

-- ── Chats, quotes, requests ─────────────────────────────────────────────
delete from public.chat_threads
 where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids);
delete from public.chat_messages where sender_id in (select id from seed_ids);

-- Remember which REAL requests only looked "quoted" because of demo
-- quotes, so they can go back to open once those quotes are gone.
create temp table touched_requests on commit drop as
  select distinct q.request_id from public.quotes q
  where q.provider_id in (select id from seed_ids);

delete from public.quotes where provider_id in (select id from seed_ids);

update public.service_requests r
   set status = 'open'
 where r.id in (select request_id from touched_requests)
   and r.status = 'quoted'
   and r.customer_id not in (select id from seed_ids)
   and not exists (select 1 from public.quotes q where q.request_id = r.id);

delete from public.chat_threads
 where request_id in (select id from public.service_requests where customer_id in (select id from seed_ids));
delete from public.service_requests where customer_id in (select id from seed_ids);  -- quotes, opportunities cascade

-- ── Everything else owned by a demo account ─────────────────────────────
delete from public.saved_providers
 where customer_id in (select id from seed_ids) or provider_id in (select id from seed_ids);
delete from public.recurring_services where created_by in (select id from seed_ids);
delete from public.projects           where created_by in (select id from seed_ids);
delete from public.organizations      where owner_id in (select id from seed_ids);
update public.user_reports set reviewed_by = null where reviewed_by in (select id from seed_ids);

delete from public.users where auth_user_id in (select id from seed_ids);  -- user_roles cascade
-- Portfolio photos, skills, categories links, service areas,
-- availability, notifications, saved locations, presence, referral codes,
-- reports, blocks etc. all cascade from profiles.
delete from public.profiles where id in (select id from seed_ids);
delete from auth.users      where id in (select id from seed_ids);

-- ── Close the demo hole in the quotes insert policy ─────────────────────
drop policy if exists "providers or the simulate button can send quotes" on public.quotes;
drop policy if exists "providers send their own quotes" on public.quotes;
create policy "providers send their own quotes" on public.quotes
  for insert with check (auth.uid() = provider_id);

-- Sanity check: should report 0 before the commit lands.
select count(*) as seed_profiles_left from public.profiles where is_seed = true
  and id not in (select id from public.admins);

commit;
