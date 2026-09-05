-- Reviews gain an optional written comment alongside the 1-5 star rating.
alter table public.reviews
  add column if not exists comment text;
