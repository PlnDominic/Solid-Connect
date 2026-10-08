-- Profiles: signed-in users can write only the columns the app writes.
--
-- Until now "users can update their own profile" let any signed-in user
-- change ANY column of their own row straight through the public API (the
-- anon key ships in the app, and the person's own login is enough). So a
-- provider could set provider_verified, provider_certified,
-- verification_level, provider_rating, provider_jobs_count or customer_rating
-- on themselves, clear their own suspension, or flag themselves is_seed. The
-- insert policy had the same hole (create a profile that starts verified).
--
-- Same approach as 0073/0075/0076 for reads: take the table-level write
-- privileges away and grant back just the columns the app writes. Those
-- columns now change only through:
--   * SECURITY DEFINER functions and triggers (rating updates, replace_provider_
--     categories, anonymize_profile ...) - they run as the table owner, so
--     these grants don't affect them
--   * the Nest API and the admin site, which use the service role
--
-- The columns granted below are exactly what src/api/profile.ts and
-- src/api/payouts.ts write:
--   insert  - createOrUpdateOwnProfile (sign-up)
--   update  - updateOwnProfile, uploadOwnProfilePhoto, the email sync, push
--             registration, the role switch, notification preferences and
--             the payout account
-- `id` is included on update because an upsert's ON CONFLICT clause sets it;
-- the "update own profile" policy still pins the row to auth.uid().
--
-- NOTE for future migrations: a column added to public.profiles is NOT
-- writable by app users until it is granted here, e.g.
--   grant update (new_column) on public.profiles to authenticated;
-- That is deliberate: a new column is private by default.

revoke insert, update on public.profiles from anon, authenticated;

grant insert (
  id, role, full_name, initials, phone, email, area, provider_category,
  terms_accepted_at, terms_version
) on public.profiles to authenticated;

grant update (
  id, role, full_name, initials, phone, email, area, provider_category,
  tagline, photo_url, push_permission_status, push_token, notification_prefs,
  payout_account, terms_accepted_at, terms_version
) on public.profiles to authenticated;
