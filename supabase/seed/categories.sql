-- Solid Connect - service categories
-- Real reference data the app needs to function (category picker, request
-- forms, etc.) - split out from seed.sql, which also has fake demo
-- providers/customers/requests you likely don't want on a production
-- project. Safe to run on its own.

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
