-- Expand from 8 home-repair trades to 30 categories spanning general
-- local services and small business, per user request ("not just
-- restricted to 8" - "other industries and business"). Same shape as the
-- original 8 (supabase/seed/categories.sql) - id/name/abbr/default_label/
-- sort_order, `active` defaults true (0029_category_archive.sql) - so
-- these show up in useCategories() immediately, no other schema change
-- needed since the app was already fully data-driven off this table.

insert into public.categories (id, name, abbr, default_label, sort_order) values
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
on conflict (id) do nothing;
