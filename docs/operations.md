# Operations runbook

Things that need an account, a secret or a dashboard click, so they cannot be done from the repo. Do them in this order.

## 1. Release order (every release)
1. Run the new SQL in Supabase (SQL editor): `supabase/apply-0082-0088.sql`, then `apply-0090-job-post-chat.sql`.
2. Build and publish the app (EAS) and deploy the admin site.
3. Only when the new app build is the one people have: run `supabase/apply-0089-after-new-builds.sql`.

## Notifications, expiry notices and forced updates
1. In the Supabase SQL Editor, run `supabase/migrations/0092_push_and_expiry_in_database.sql`, then `0093_minimum_app_version.sql`. The database now sends phone notifications every 30 seconds and job post expiry notices every 5 minutes. No server is needed. If an older copy of the `api/` server is running, stop it or deploy the current one, or messages may be sent twice.
2. To see whether notifications are going out: `select status, error, count(*) from public.push_outbox where created_at > now() - interval '1 day' group by 1, 2;`
   `sent` means Expo accepted it. `NO_TOKEN` means that person's phone has not registered. `InvalidCredentials` means the Apple or Android push key is missing or wrong in EAS.
3. To make old versions update: raise `version` in `app.json`, publish that build, and **only once it is in the stores** run `update public.platform_config set min_app_version = '1.1.0' where id = true;` (with that version). Set it to `null` to stop. Builds made before this check was added ignore it.

## 2. Backups and disaster recovery (Supabase)
- Plan: the Free plan has no backups you can restore. Move to Pro and turn on **Point in Time Recovery** (Project settings > Add-ons) so you can restore to any minute in the last 7 days.
- Storage buckets are not in database backups. Once a week, download `verification-docs`, `portfolio` and `request-photos` (Supabase CLI: `supabase storage cp -r ss:///verification-docs ./backup/`), or copy them to a second bucket on another provider.
- Keep a copy of every `supabase/migrations` file in git (already true) and the SQL bundles. A rebuild is: new project, run all migrations in order, restore data.
- Test a restore once into a throwaway project and write down how long it took. That number is your real recovery time.

## 3. Staging environment
- Create a second Supabase project called `solid-connect-staging`. Run all migrations there.
- In `eas.json` add a `preview` profile with its own `EXPO_PUBLIC_SUPABASE_URL` and anon key. Admin: a second Vercel project pointing at the staging project.
- Rule: every migration runs on staging first, then production.

## 4. Admin two-step sign-in (MFA)
1. Supabase > Authentication > Multi-factor: make sure **TOTP** is enabled.
2. Deploy the admin site. Sign in as each admin and open `/mfa` to scan the QR code with an authenticator app. Do this for **every** admin before step 3.
3. Set `ADMIN_REQUIRE_MFA=true` in the admin site environment and redeploy. From then on every page and action needs the six digit code.
- Locked out? Remove the factor in Supabase > Authentication > Users > the user > Factors, or unset `ADMIN_REQUIRE_MFA` and redeploy.

## 5. App error reporting
- Crashes and unexpected errors from the app are written to `client_errors` and shown in admin under **App errors** (owner only). They arrive after the next app build.
- If you later want alerts and source maps, add Sentry on top; the reporter in `src/lib/errorReporting.ts` is the one place to change.

## 6. SMS sign-in (phone OTP)
Solid Connect collects a contact phone number in the profile. Password sign-in uses email. Phone sign-in would require verifying and linking the number to the Supabase Auth identity before offering it on the sign-in screen.

## Customer support
Verify that `cosolid93@gmail.com` is owned and monitored before release. To offer WhatsApp support, set `EXPO_PUBLIC_SUPPORT_WHATSAPP` in the mobile build environment to the staffed number in international format, with no spaces or dashes.

## Customer booking integrity
Apply migration `0091_customer_booking_integrity.sql` before releasing the mobile build that checks quote revisions and sends requests from public posts in one transaction.

## 7. NestJS API
The app works without it (everything goes through Supabase). Deploy it only if you want it. When you do: host on Railway/Render/Fly, set the variables from `api/.env.example`, then set `EXPO_PUBLIC_API_URL` in the EAS profile. Until then leave `EXPO_PUBLIC_API_URL` unset.

## 8. Dependency audit
Run `npm audit` in the repo root and in `admin/` before each release. Known and accepted: `admin` reports PostCSS inside Next 15; the fix is Next 16 (a major upgrade, to schedule). Root reports moderate dev-tool findings (`glob`, `minimatch` via `@expo/fingerprint`) that are not shipped in the app.
