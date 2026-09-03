-- Solid Connect - profile contact fields
-- Adds phone and email, collected during the sign-up detail-entry flow
-- (name -> phone -> email -> role). Nullable: not every existing/seed row
-- has them, and demo mode still doesn't verify either one - they're
-- display/contact fields, not auth identifiers, until real phone/email
-- verification is built (see docs/marketplace-mechanics.md).

alter table public.profiles
  add column if not exists phone text,
  add column if not exists email text;
