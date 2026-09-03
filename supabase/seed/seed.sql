-- Solid Connect — demo seed data
-- Populates the marketplace with the same Accra-flavored sample data the
-- Claude Design prototype shipped with, so the app isn't empty on first run.
-- Seed rows are marked is_seed = true where applicable.

insert into public.categories (id, name, abbr, default_label, sort_order) values
  ('plumbing',   'Plumbing',   'PL', 'Plumbing · Pipe repair',    1),
  ('electrical', 'Electrical', 'EL', 'Electrical · Wiring',       2),
  ('carpentry',  'Carpentry',  'CA', 'Carpentry · Repair',        3),
  ('masonry',    'Masonry',    'MA', 'Masonry · Repair',          4),
  ('painting',   'Painting',   'PA', 'Painting · Interior',       5),
  ('welding',    'Welding',    'WE', 'Welding · Repair',          6),
  ('cleaning',   'Cleaning',   'CL', 'Cleaning · Deep clean',     7),
  ('ac_repair',  'AC repair',  'AC', 'AC repair · Servicing',     8)
on conflict (id) do nothing;

-- seed providers (the marketplace supply side you browse/quote/hire)
insert into public.profiles
  (id, role, full_name, initials, area, is_seed, provider_category,
   provider_rating, provider_jobs_count, provider_distance_km, provider_verified, provider_certified)
values
  ('11111111-1111-4111-8111-111111111111', 'provider', 'Kwesi Amankwah', 'KA', 'East Legon, Accra', true,
   'Plumber', 4.8, 126, 2.4, true, false),
  ('22222222-2222-4222-8222-222222222222', 'provider', 'Ama Boateng', 'AB', 'East Legon, Accra', true,
   'Plumber', 4.9, 212, 3.1, true, true),
  ('33333333-3333-4333-8333-333333333333', 'provider', 'Yaw Osei', 'YO', 'East Legon, Accra', true,
   'Electrician', 4.7, 89, 1.8, true, false),
  ('44444444-4444-4444-8444-444444444444', 'provider', 'Samuel Mensah', 'SM', 'East Legon, Accra', true,
   'Plumber', 4.6, 58, 4.7, true, false)
on conflict (id) do nothing;

-- seed customers (so the provider Feed has real "nearby requests" to browse)
insert into public.profiles (id, role, full_name, initials, area, is_seed) values
  ('55555555-5555-4555-8555-555555555555', 'customer', 'Efua Mensah', 'EM', 'East Legon, Accra', true),
  ('66666666-6666-4666-8666-666666666666', 'customer', 'Kojo Owusu', 'KO', 'Trasacco Valley, Accra', true)
on conflict (id) do nothing;

insert into public.service_requests
  (id, customer_id, category_id, category_label, description, budget_min, budget_max, location_label, status, created_at)
values
  ('aaaaaaaa-0001-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'plumbing',
   'Plumbing · Pipe repair', 'Kitchen sink has been leaking under the cabinet since yesterday.',
   300, 600, 'East Legon', 'open', now() - interval '12 minutes'),
  ('aaaaaaaa-0001-4000-8000-000000000002', '66666666-6666-4666-8666-666666666666', 'plumbing',
   'Plumbing · Water heater installation', 'New water heater needs to be installed in the main bathroom, unit already purchased.',
   800, 1200, 'Trasacco Valley', 'open', now() - interval '20 minutes'),
  ('aaaaaaaa-0001-4000-8000-000000000003', '55555555-5555-4555-8555-555555555555', 'plumbing',
   'Plumbing · Bathroom pipe leak', 'Slow leak under the bathroom sink, needs inspection and repair.',
   200, 350, 'Airport Residential', 'open', now() - interval '1 hour')
on conflict (id) do nothing;
