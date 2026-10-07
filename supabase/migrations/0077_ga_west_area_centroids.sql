-- Ga West / northern Accra neighbourhoods missing from 0068. Without
-- these, GPS near Sapiman/Opa snapped to Kwabenya (~10 km away) because
-- that was the closest listed centroid.

insert into public.area_centroids (name, location) values
  ('Sapiman',   ST_SetSRID(ST_MakePoint(-0.312, 5.725), 4326)::geography),
  ('Opa',       ST_SetSRID(ST_MakePoint(-0.324, 5.721), 4326)::geography),
  ('Ofankor',   ST_SetSRID(ST_MakePoint(-0.280, 5.680), 4326)::geography),
  ('Pokuase',   ST_SetSRID(ST_MakePoint(-0.283, 5.690), 4326)::geography),
  ('Amasaman',  ST_SetSRID(ST_MakePoint(-0.305, 5.705), 4326)::geography),
  ('Achiman',   ST_SetSRID(ST_MakePoint(-0.295, 5.695), 4326)::geography),
  ('Taifa',     ST_SetSRID(ST_MakePoint(-0.245, 5.675), 4326)::geography),
  ('Atomic',    ST_SetSRID(ST_MakePoint(-0.215, 5.670), 4326)::geography),
  ('Dome Pillar 2', ST_SetSRID(ST_MakePoint(-0.240, 5.655), 4326)::geography),
  ('Ablekuma',  ST_SetSRID(ST_MakePoint(-0.280, 5.570), 4326)::geography),
  ('Mallam',    ST_SetSRID(ST_MakePoint(-0.295, 5.555), 4326)::geography),
  ('Gbawe',     ST_SetSRID(ST_MakePoint(-0.310, 5.565), 4326)::geography),
  ('McCarthy Hill', ST_SetSRID(ST_MakePoint(-0.275, 5.575), 4326)::geography),
  ('Sowutuom',  ST_SetSRID(ST_MakePoint(-0.270, 5.620), 4326)::geography),
  ('Anyaa',     ST_SetSRID(ST_MakePoint(-0.275, 5.640), 4326)::geography),
  ('CP',        ST_SetSRID(ST_MakePoint(-0.255, 5.640), 4326)::geography)
on conflict (name) do nothing;
