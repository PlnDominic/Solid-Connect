# Launch readiness audit

_Audited 2026-10-08 against `main` at `c83757a`. Covers the mobile app (repo root),
the admin site (`admin/`), the NestJS API (`api/`) and the Supabase schema
(`supabase/migrations`, 0001–0077)._

**How this was done:** read the code, migrations, config and docs; ran the API and admin
production builds (both pass), the app's type-check and tests (26 suites, 235 tests pass),
`npm audit` on all three packages and `expo-doctor`.

**What this audit could NOT see:** the live Supabase project (`pkueweyzfsrjvcftbrct`) is on
a different account from the one the tooling can reach. Every database finding below comes
from the migration files, not the live database. Section 1 has a query to confirm each one
on the live project before you act on it.

Size guide: **S** = under a day, **M** = a few days, **L** = a week or more, **Ext** = depends
on someone outside the code (a vendor, a lawyer, a store).

---

## 0. Where things stand

Built and working: sign-up/sign-in (email, Google, Apple), request → match → quote → job →
chat → completion → review, staged provider verification, live job location, Hubtel checkout
with deposit + balance, commission and payout rows, in-app notifications and push queue,
reports/blocks/safety alerts, organizations and recurring services, a full admin site, and a
contact-detail filter on chat.

**Nothing is deployed.** There is no hosting config for the API, no deploy pipeline, no
store listing, and the legal documents are unreviewed drafts.

---

## Progress on section 1 (updated 2026-10-08)

| Item | Status |
|---|---|
| 1.1 Profile self-editing | **Fixed in code, needs the migration applied** (0078) |
| 1.2 Direct writes to jobs/quotes/requests | **Fixed in code, needs the migration applied** (0079). Quotes were already not directly editable (0055), so the original wording below overstated that part. |
| 1.3 Public reads of requests/quotes/jobs/saved providers | **Fixed in code, needs the migration applied** (0080) |
| 1.6 API hardening | **Done** (trust proxy, CORS, docs hidden in production, security headers, refuses to start misconfigured in production) |
| 1.7 Suspension | **Partly done**: the API now honours an admin suspension on every request. Direct database access and an instant sign-out are still open. |
| 1.9 Dependencies | **Mostly done**: API 5 -> 2 moderate, admin 4 -> 2 (the rest need breaking upgrades) |
| 1.4 Public photo buckets, 1.5 admin MFA, 1.8 admin headers | Not started |

To apply: paste [supabase/apply-0077-0080.sql](../supabase/apply-0077-0080.sql) into the Supabase SQL editor,
**after trying it on a copy first** (its header lists what to click through). The rules are covered by
`npm run test:rls` (77 checks, also run in CI).

Found while doing this: the app's sign-up saved the profile with an "upsert" that names the phone and email
columns. Since 0073/0076 hid those columns from app users, Postgres refuses that statement. Sign-up now
inserts, and updates if the profile already exists (`src/api/profile.ts`).

---

## 1. Security: fix before any real user signs up

### 1.1 Any user can edit privileged columns on their own profile — **Blocker, S–M**
`profiles` has an `UPDATE` policy of `auth.uid() = id` with no column limit, and the `INSERT`
policy only checks the id (0001). No migration through 0076 adds a trigger or column-level
`UPDATE` revoke. The app itself only writes safe columns, but anyone with the public anon key and
their own login can call the database directly and set `provider_verified`, `provider_certified`,
`verification_level`, `provider_rating`, `provider_jobs_count`, `role`, or clear their own
`suspended_at`. That defeats the whole "verified providers" promise.
**Fix:** revoke `UPDATE`/`INSERT` on `profiles` from `authenticated`, then grant only the
columns the app writes (name, phone, area, tagline, photo, category, availability, location,
notification prefs, push token/status, terms fields). Same for the insert.

### 1.2 Jobs can be edited column-by-column by either party — **Blocker, M**
`jobs` update policy: `customer_id = uid OR provider_id = uid`, any column (0001). The only guard is
the deposit trigger (0065). (Quotes are not affected: 0055 already removed the customer's update policy.)
Money state is protected (payments are RPC-only, 0041), but a provider can flip a job to `completed` or
change `price`/`step` directly.
**Fix (done, 0079):** every real job change already goes through a database function, so direct
writes to `jobs` are revoked entirely; quotes and requests can only be created, with limited columns.

### 1.3 Requests, jobs, quotes and saved providers are readable by everyone — **Blocker, M**
`service_requests`, `quotes`, `jobs`, `saved_providers` all have `FOR SELECT USING (true)` with no
`TO authenticated` (0001), so a logged-out caller with the anon key can read every customer's request
text, photos, area, budget, quote prices and who hired whom. 0041 fixed this for `payments` only.
**Fix:** restrict reads to the parties, matched providers (for open requests) and admins.

### 1.4 Chat and request photos sit in public storage buckets — **Should, M**
`chat-photos` and `request-photos` are public (0033, 0010). URLs are hard to guess but are not secret.
Home interiors and private chat images should use signed URLs. `profile-photos` and
`portfolio-photos` being public is fine.

### 1.5 Admin has no multi-factor sign-in — **Blocker, M**
The roadmap calls for MFA on admin accounts; none exists. The admin site holds the service-role key and
can refund payments, mark payouts paid and delete accounts. Add Supabase TOTP MFA and require it
(AAL2) for every admin route.

### 1.6 API hardening — **Blocker, S**
- No `trust proxy` setting. Behind a load balancer, the rate limiter will see one IP for everyone and
  lock out all users together (global limit is 120/min).
- `CORS_ORIGINS` empty means "allow any origin" (`main.ts`). Make it required in production.
- Swagger docs are public at `/docs`. Turn off in production.
- No `helmet` security headers.
- Payments webhook has no IP allow-list or signature (it does re-check with Hubtel, which is good).
- Rate limiting is in memory, so it resets on deploy and doesn't share across instances.
- `SupabaseJwtGuard` fails open: if the user lookup throws, it defaults to an active customer.

### 1.7 Suspension only takes effect on the next app launch — **Should, M**
Documented trade-off (0026). A suspended user keeps a working session until they relaunch. For a
payments marketplace, enforce it in RLS and in the API guard too.

### 1.8 Admin site headers and login protection — **Should, S**
No CSP, frame-options or HSTS in `next.config.ts`. Login relies only on Supabase's own throttling.

### 1.9 Dependency vulnerabilities — **Should, S**
`npm audit --omit=dev`: API 5 (1 critical: `proxy-addr` IP spoofing; multer DoS), admin 4 (Next.js
cache-poisoning, PostCSS, sharp), app 43 (mostly Expo build tooling that never ships in the app).
`npm audit fix` is available for the API and admin.

### 1.10 Verify on the live project (read-only)
```sql
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','jobs','service_requests','quotes','saved_providers');

select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon','authenticated') and privilege_type = 'UPDATE';
```
Also run the Supabase **Security Advisor** and **Performance Advisor** in the dashboard.

---

## 2. Payments (the business model)

- [ ] **Hubtel go-live — Ext.** Merchant account approved, live client id/secret/merchant number, prepaid
      account funded for payouts, `HUBTEL_CALLBACK_URL` public and reachable. Hubtel typically requires
      your server's outbound IP to be whitelisted, so the API host needs a static IP. Confirm with Hubtel.
- [ ] **Fail hard if Hubtel is not configured in production — S.** Today, with no Hubtel vars,
      `assertHeldIfGatewayLive` returns early and a customer can confirm completion without paying
      (release-on-confirm simulation). A misconfigured deploy would silently run unpaid jobs.
- [ ] **Reconcile missed webhooks — M.** A payment is only checked when Hubtel calls back or the customer
      returns to the app. If both are missed it stays `pending` forever. Add a periodic job that re-checks
      pending references.
- [ ] **Payout results — M.** Hubtel response code `0001` (as I understand it, "request accepted, final
      result comes by callback" - confirm in Hubtel's docs) is recorded as `paid`; payout
      callbacks (`po_…` references) are ignored; a thrown error leaves the payout `pending` with no retry.
      Handle the callback, record real final status, add a retry/“failed payouts” workflow.
- [ ] **Refunds don't move money — M.** Admin "refund" only changes the status. Someone must send the
      money back by hand in the Hubtel dashboard. Either automate through Hubtel or write the manual
      procedure and a way to mark it done.
- [ ] **Remove "simulated" wording — S.** `src/lib/legal.ts` (in-app summary), the admin Payments page
      subtitle, and Terms §7 all say payments are simulated.
- [ ] **Payment Methods screen does nothing — S.** It stores a device-only preference that no flow reads.
      Remove it or make it real.
- [ ] **Escrow/licensing — Ext.** Holding customer money before releasing it may need a Bank of Ghana
      licence or a partner arrangement. Counsel to confirm (already in `docs/legal/README.md`).
- [ ] **Tax/invoicing — Ext.** Confirm VAT/GRA treatment of commission and what a receipt must show.

---

## 3. Hosting and infrastructure (nothing is deployed)

- [ ] **Pick and set up API hosting — M.** There is no Dockerfile, Procfile or platform config. The
      API runs only with `npm run start:dev` today. Needs HTTPS domain, env vars, health check, static IP.
- [ ] **Run one API instance, or fix the workers — S/M.** Push draining claims rows safely, but the
      recurring-services worker does not claim before creating requests, so two instances would create
      duplicate requests. Keep it to one instance or add a claim.
- [ ] **Redis: use it or drop it — S.** Redis is only used by `/health`, which reports "degraded"
      without it. Either remove the check or provision Redis.
- [ ] **Deploy the admin site — S.** Set `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`,
      `ADMIN_SITE_URL`; keep `LEGAL_PAGES_PUBLISHED=false` until counsel approves.
- [ ] **Supabase production setup — M.** Paid plan for daily backups/point-in-time recovery and no
      auto-pause; **custom SMTP** (the built-in sender is heavily rate-limited, and email confirmation,
      password reset and admin invites all depend on it); Site URL must be https; allow-list the redirect
      URLs; enable `pg_cron` (0036 needs it); apply every migration in order (note numbers 0048 and
      0051 do not exist, so confirm that is intentional) plus 0077; run `supabase/cleanup` to remove demo
      data and the demo-quote policy exception; keep a separate staging project.
- [ ] **One domain, set up properly — Ext.** The repo uses `solidconnect.co`, `solidconnect.app` and
      `solidconnectltd.com` in different places. Pick one, then create `support@`, SPF/DKIM/DMARC, and
      `api.` / `admin.` subdomains.
- [ ] **Google and Apple sign-in config — Ext.** Publish the Google OAuth consent screen; create the
      Apple Services ID and key; enter both in Supabase.
- [ ] **Monitoring — M.** No crash reporting, no error boundary, no uptime monitor, no alerting. The
      architecture doc promises Sentry/OpenTelemetry; none is installed. Add Sentry (app, API, admin)
      and an uptime check on `/health`.
- [ ] **Deploy pipeline — M.** CI runs tests on every branch but nothing builds or deploys. Add EAS
      build/submit workflows and auto-deploy for API and admin.
- [ ] **Per-environment config — S.** `eas.json` has no `env` per profile. Production builds must get
      `EXPO_PUBLIC_API_URL` (https), the Supabase URL/key and `EXPO_PUBLIC_LEGAL_URL`. The default is
      `localhost`.
- [ ] **Backup restore drill and runbook — S.** Write down how to restore, rotate keys, and roll back.
- [ ] **Map tiles — S.** Maps use OpenStreetMap's free tile servers, which don't allow heavy use from a
      published app. Move to a paid tile provider (MapTiler, Stadia, etc.) before launch.

---

## 4. Mobile app: build and store readiness

- [ ] **Real app icon, Android icon, splash and notification icon — S.** `icon.png`,
      `android-icon-*.png` and `splash-icon.png` are Expo's default template art, not Solid Connect.
      Stores will reject or users will see another brand. The real logo is `assets/images/logo.jpeg`.
- [ ] **Fix `expo-doctor` failures — S.** Missing peer `expo-asset` (needed by `expo-audio`, so voice
      notes may crash in a real build), duplicate `expo-constants`, `eas-cli` listed as a project
      dependency, 10 packages behind the SDK 57 patch versions.
- [ ] **Push notifications on real devices — M.** Android needs `android.googleServicesFile` and FCM
      credentials uploaded to EAS; iOS needs the APNs key via EAS. Neither is set up. Test on both.
- [ ] **Decide on over-the-air updates — S.** `eas.json` defines update channels but `expo-updates` is not
      installed, so every fix needs a store release.
- [ ] **EAS submit config — Ext.** `submit.production` is empty (App Store Connect app id, Google service
      account key).
- [ ] **Store accounts — Ext.** Apple Developer (a company account needs a D-U-N-S number, which can
      take weeks) and Google Play (new personal accounts have to run a closed test for a set period
      first; check current rules).
- [ ] **Store listings — Ext.** Screenshots, description, keywords, support URL, privacy policy URL (blocked
      until legal is published), age rating, Apple privacy labels, Play Data Safety form, location/microphone
      justifications, and **a web link for account deletion** (Play requires one on top of the in-app flow).
- [ ] **Reviewer demo accounts — S.** A customer and a verified provider with a job in each state, so
      the store reviewer can test every flow.
- [ ] **User-generated-content rules (Apple 1.2) — S.** Report and block exist; add a published promise
      and an owner to act on reports within a day.
- [ ] **Links that open the app — M.** Only the `solidconnect://` scheme exists. Referral invites shared
      in WhatsApp/SMS and email-confirmation links won't be tappable or reliable. Add universal links /
      app links with a small web page on your domain.
- [ ] **Phone number verification — M.** Phone numbers are only format-checked; no SMS code. Fake numbers
      and unreachable providers are likely, and the phone is the default MoMo payout number. Add an SMS
      provider (e.g. Hubtel SMS or another Ghana gateway) and verify numbers.
- [ ] **Help & Support screen — S.** Phone `+233 30 200 0000` looks like a placeholder, and the email is
      `support@solidconnect.app` while everything else uses `.co`. A `support_tickets` table exists
      (0061) but nothing in the app or admin uses it. Choose the real support channel.
- [ ] **Twi and Ga language — S/L.** Only about 20 labels are translated (tabs, a few buttons, Home);
      the rest shows in English. Hide the language option or commit to translating.
- [ ] **Provider Agreement acceptance — S.** Providers only tick the general Terms box; there is no
      step where they accept the Provider Agreement or confirm payout terms.
- [ ] **Account deletion leaves files behind — S.** `anonymize_profile` clears the profile but does not
      remove stored photos or verification documents, which the Privacy Policy says are removed.
      Deletion is also manual, so set a response time.
- [ ] **Quality assurance — M/L.** Unit tests only (26 suites). Nothing covers screens, RLS rules,
      the payments service or webhooks. Needs a real-device pass (iOS and low-end Android, bad network),
      a payment test with real small amounts, a load test of the API, and an outside security test.

---

## 5. Admin site: remaining work

- [ ] MFA, security headers, deployment (see 1.5, 1.8, 3).
- [ ] Support inbox — nothing reads `support_tickets` (see section 4).
- [ ] Refund and payout actions that actually move money, plus a failed-payouts and stuck-payments view
      (see section 2).
- [ ] Written procedures for the people running it: verifying providers, resolving disputes, processing
      refunds and payouts, handling safety alerts and reports, completing deletion requests.
- [ ] Reports/safety alerts should notify someone (the sidebar banner only shows when an admin is
      looking).
- [ ] Publish `/legal` (needs counsel, then `LEGAL_PAGES_PUBLISHED=true`).

---

## 6. Legal and compliance (needs people, not code)

- [ ] Counsel review of Terms, Privacy Policy, Provider Agreement and Refund & Dispute Policy. All are
      marked DRAFT, with placeholders for limitation of liability, governing law, data residency and a
      data-protection officer. New section 11 (copyright) needs the same review.
- [ ] Register with Ghana's Data Protection Commission (Act 843); confirm data region and cross-border
      transfer position.
- [ ] Confirm the payment-licensing position (section 2) and business registration for the stores.
- [ ] If you'll have US users: register a copyright (DMCA) agent.
- [ ] After approval: remove draft banners, set `LEGAL_PAGES_PUBLISHED=true` and `EXPO_PUBLIC_LEGAL_URL`, use
      the privacy URL in both stores.

---

## 7. Go-to-market (not code, but it decides whether launch works)

- [ ] Launch scope: 29 service categories are live; the roadmap recommends a few high-demand ones in one
      area first.
- [ ] Supply: enough verified providers per category per area before opening to customers.
- [ ] Staffing: someone for verification queue, support, disputes, payouts, and safety alerts, every day.
- [ ] A closed beta (TestFlight / Play internal testing) with real jobs and real small payments.
- [ ] Pricing and commission decided (currently 15%, deposit 30%).

---

## 8. Housekeeping

- README "Status" and `docs/roadmap-and-risks.md` are out of date (they still say push and the EAS project
  are missing and payments are not built; the roadmap stops at migration 0029).
- Remove stray files from the repo: `api/.tmp-0013.json`; and local clutter folders
  (`.freebuff/`, `.superpowers/`, `Local-Drop-Shipping/`, `.worktrees/`, `.claude/worktrees/`).
- Replace the boilerplate `api/README.md` with real setup and deploy notes.

---

## Suggested order

1. **Week 1, security:** 1.1, 1.2, 1.3, 1.5, 1.6, 1.9, then verify on the live project.
2. **Week 1–2, in parallel (long lead times):** Apple/Google accounts, Hubtel merchant approval, counsel
   review, domain and mailboxes, SMTP.
3. **Week 2–3, build:** hosting and monitoring, payments fixes, real icons, push setup, `expo-doctor` fixes.
4. **Week 3–4, test:** real-device pass, small-money payment test, closed beta, store submission.
