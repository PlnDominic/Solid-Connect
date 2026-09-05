-- Solid Connect - phone uniqueness
-- One phone number per account. A plain unique constraint is nulls-safe in
-- Postgres (multiple rows with a null phone don't conflict), so existing
-- rows and accounts that skip the phone step are unaffected. Email doesn't
-- need an equivalent here - auth.users already enforces that uniquely.

alter table public.profiles
  add constraint profiles_phone_key unique (phone);
