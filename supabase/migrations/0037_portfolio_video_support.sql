-- Solid Connect - item 5 from the mobile-app gap list: portfolio video
-- support. provider_portfolio_photos keeps its name and its photo_url
-- column (a rename would also touch the Nest API's GET /providers/:id/
-- portfolio and the admin provider detail page for a table this small
-- and this contained - not worth the wider churn); photo_url now holds
-- either a photo or a video's public URL, disambiguated by media_type.
alter table public.provider_portfolio_photos
  add column if not exists media_type text not null default 'photo' check (media_type in ('photo', 'video'));
