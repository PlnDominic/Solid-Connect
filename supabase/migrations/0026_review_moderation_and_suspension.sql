-- Review moderation: hide/unhide a review without deleting it. The
-- provider's aggregate rating/jobs count (kept as a running average by
-- apply_review() in 0001_init.sql) is recomputed in application code
-- (admin/app/(protected)/reviews/actions.ts) each time a review's
-- hidden state changes, using the same commutative-average math the
-- trigger already relies on - removing/restoring one review's
-- contribution doesn't depend on insertion order.

alter table public.reviews
  add column if not exists hidden_at timestamptz;

alter table public.reviews
  add column if not exists hidden_by uuid references public.admins(id);

-- Public/customer/provider reads now exclude hidden reviews; admins still
-- see everything (the moderation UI itself needs to).
drop policy if exists "reviews are publicly readable" on public.reviews;
create policy "reviews are publicly readable" on public.reviews
  for select using (hidden_at is null or public.is_admin());

-- Account suspension: an admin can freeze a customer or provider account.
-- Deliberately minimal enforcement, not a full RLS lockout across every
-- table: the mobile app checks suspended_at once, at app-launch sign-in
-- (src/lib/auth.ts getCurrentUserId), and force-signs-out with a clear
-- reason if set. A suspension applied mid-session takes effect on that
-- person's next app launch, not instantly - an accepted, scoped trade-off
-- for how small this change is versus threading a suspension check
-- through every insert policy in the schema.

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists suspended_reason text;

alter table public.profiles
  add column if not exists suspended_by uuid references public.admins(id);
