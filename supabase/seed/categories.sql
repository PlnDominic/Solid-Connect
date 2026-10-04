-- Solid Connect - service categories
-- Real reference data the app needs to function (category picker, request
-- forms, etc.). The old demo seed.sql (fake providers, customers and
-- requests) has been removed - see supabase/cleanup/. Safe to run on its own.

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

-- Categories 9-30: see migrations/0038_expand_categories.sql for the full
-- list and rationale (kept there rather than duplicated here since this
-- file's own comment above says categories are "real reference data" the
-- migration already inserts into any environment it runs against).
insert into public.categories (id, name, abbr, default_label, sort_order)
select * from (values
  ('landscaping',      'Landscaping',        'LS', 'Landscaping · Gardening',        9),
  ('moving_hauling',   'Moving & Hauling',   'MV', 'Moving · Hauling',               10),
  ('pest_control',     'Pest Control',       'PC', 'Pest control · Fumigation',      11),
  ('locksmith',        'Locksmith',          'LK', 'Locksmith · Lock repair',        12),
  ('appliance_repair', 'Appliance Repair',   'AP', 'Appliance repair · Servicing',   13),
  ('auto_mechanic',    'Auto Mechanic',      'AM', 'Auto mechanic · Car repair',     14),
  ('photography',      'Photography',        'PH', 'Photography · Events',          15),
  ('videography',      'Videography',        'VD', 'Videography · Editing',         16),
  ('catering',         'Catering',           'CT', 'Catering · Event food',         17),
  ('event_planning',   'Event Planning',     'EP', 'Event planning · Coordination', 18),
  ('tailoring',        'Tailoring',          'TL', 'Tailoring · Fashion design',     19),
  ('beauty_salon',     'Beauty & Salon',     'BS', 'Beauty · Hair & salon',          20),
  ('fitness_training', 'Fitness Training',   'FT', 'Fitness · Personal training',    21),
  ('it_support',       'IT Support',         'IT', 'IT support · Computer repair',   22),
  ('tutoring',         'Tutoring',           'TU', 'Tutoring · Education',           23),
  ('interior_design',  'Interior Design',    'ID', 'Interior design · Decor',        24),
  ('security_services','Security Services',  'SC', 'Security · Guard services',      25),
  ('dj_sound',         'DJ & Event Sound',   'DJ', 'DJ · Event sound',               26),
  ('marketing_design', 'Marketing & Design', 'MD', 'Marketing · Graphic design',     27),
  ('accounting',       'Accounting',         'AB', 'Accounting · Bookkeeping',       28),
  ('web_tech',         'Web & Tech',         'WT', 'Web & tech · App development',   29),
  ('real_estate',      'Real Estate',        'RE', 'Real estate · Rentals',          30)
) as v(id, name, abbr, default_label, sort_order)
on conflict (id) do nothing;
