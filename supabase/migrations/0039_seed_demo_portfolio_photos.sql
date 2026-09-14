-- Give the 4 demo providers (supabase/seed/seed.sql) a few portfolio
-- photos each, so the Home screen's "Top rated nearby" photo-grid preview
-- (see TopProviderCard in src/screens/customer/HomeScreen.tsx) actually
-- has something to show for them instead of falling back to a bare
-- header. Real provider accounts are untouched - this only ever targets
-- the four is_seed=true provider ids seed.sql itself creates.
--
-- Photos are free Pexels stock photos (Pexels License: free for
-- commercial and personal use, no attribution required), picked to match
-- each provider's trade. Hotlinked from images.pexels.com rather than
-- copied into this app's own storage bucket, same as any other
-- externally-hosted photo_url already accepted by this table.
--
-- Note: the project's live database was already seeded independently at
-- some point and now holds a different 4th seed provider (Akoa Adjei,
-- Carpentry/Painting, a different id) than what seed.sql itself currently
-- creates (Samuel Mensah, Plumbing) - seed.sql and the live schema have
-- drifted. This migration targets seed.sql's own ids so it stays correct
-- for anyone provisioning fresh from it; the live database's actual
-- current providers were given matching photos directly, out of band.

insert into public.provider_portfolio_photos (provider_id, photo_url, media_type)
select * from (values
  -- Kwesi Amankwah - Plumbing
  ('11111111-1111-4111-8111-111111111111'::uuid, 'https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'https://images.pexels.com/photos/16509869/pexels-photo-16509869.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'https://images.pexels.com/photos/7937299/pexels-photo-7937299.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  -- Ama Boateng - Plumbing
  ('22222222-2222-4222-8222-222222222222'::uuid, 'https://images.pexels.com/photos/29226620/pexels-photo-29226620.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'https://images.pexels.com/photos/7937300/pexels-photo-7937300.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'https://images.pexels.com/photos/7937292/pexels-photo-7937292.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  -- Yaw Osei - Electrical
  ('33333333-3333-4333-8333-333333333333'::uuid, 'https://images.pexels.com/photos/442160/pexels-photo-442160.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'https://images.pexels.com/photos/2898199/pexels-photo-2898199.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'https://images.pexels.com/photos/4981803/pexels-photo-4981803.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  -- Samuel Mensah - Plumbing
  ('44444444-4444-4444-8444-444444444444'::uuid, 'https://images.pexels.com/photos/8486975/pexels-photo-8486975.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'https://images.pexels.com/photos/8488060/pexels-photo-8488060.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'https://images.pexels.com/photos/5691653/pexels-photo-5691653.jpeg?auto=compress&cs=tinysrgb&w=600&h=600&fit=crop', 'photo')
) as v(provider_id, photo_url, media_type)
where exists (select 1 from public.profiles where id = v.provider_id)
  and not exists (
    select 1 from public.provider_portfolio_photos p
    where p.provider_id = v.provider_id and p.photo_url = v.photo_url
  );
