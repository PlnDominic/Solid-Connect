-- Ratings come only from real reviews.
--
-- profiles.provider_rating defaulted to 4.8, so every provider with no reviews
-- looked 4.8-star rated, and providers created from demo data carried
-- made-up ratings and job counts. A rating now only exists once someone has
-- actually reviewed the provider:
--   * new providers start at 0 with 0 reviews (the app shows "New")
--   * existing providers are recomputed from their visible reviews
--
-- Run supabase/cleanup/02-remove-seed-data.sql first if demo accounts and their
-- reviews are still in the database; this migration then recomputes from what
-- is left. Hidden (moderated) reviews do not count, same as the admin tooling.
-- The apply_review() trigger already keeps a running average from here on.

alter table public.profiles alter column provider_rating set default 0;

update public.profiles p
set
  provider_rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from public.reviews r
    where r.provider_id = p.id and r.hidden_at is null
  ), 0),
  provider_jobs_count = (
    select count(*)::int
    from public.reviews r
    where r.provider_id = p.id and r.hidden_at is null
  )
where p.role = 'provider';
