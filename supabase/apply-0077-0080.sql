-- Solid Connect: migrations 0077-0080 in one paste
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
--
-- What it does:
--   0077  adds the "copyright" report reason
--   0078  app users can write only the profile columns the app writes
--         (no more self-verifying, self-rating or un-suspending)
--   0079  no direct writes to jobs; quotes and requests can only be created,
--         with limited columns; everything else goes through the existing functions
--   0080  requests, quotes, jobs and saved providers are readable only by the
--         people involved (and admins), and not at all while signed out
--
-- BEFORE YOU RUN IT on the live project:
--   * Try it on a copy first (a Supabase branch or a second project) and click
--     through sign-up, posting a request, sending and accepting a quote, a job
--     from start to finish, chat, and the admin site's Jobs / Requests pages.
--   * Run it in one go; every statement can safely be run again.
--   * It assumes 0073, 0075 and 0076 (hidden phone / payout / email columns) are
--     already applied, as the app expects.
-- Rolling back: re-grant what you need, e.g.
--   grant update on public.profiles to authenticated;   -- reopens 0078
-- (but do not leave the old open rules in place on a live project).

-- ===== 0077_copyright_reports.sql =====
-- Copyright reports: photos and work people upload that aren't theirs.
--
-- Profile photos, portfolio photos/videos, request photos and chat images
-- are all user uploads. The Terms (docs/legal/terms-of-service.md §11) now
-- promise a way to report content that infringes someone's copyright and
-- that we take it down; this adds that reason to the existing report flow
-- (src/components/ReportSheet.tsx), reviewed on the admin Reports page.

alter table public.user_reports drop constraint if exists user_reports_reason_check;
alter table public.user_reports add constraint user_reports_reason_check
  check (reason in ('harassment', 'scam_or_fraud', 'inappropriate_content', 'unsafe_behavior', 'fake_profile', 'other', 'contact_sharing', 'copyright'));

-- ===== 0078_lock_down_profile_writes.sql =====
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

-- ===== 0079_lock_down_marketplace_writes.sql =====
-- Jobs, quotes and requests: app users can no longer write them directly.
--
-- RLS decides WHICH ROWS a person can touch, not which columns. The old
-- policies let either party update any column of a job (status, step, price,
-- timestamps) through the public API, and let a customer insert a request
-- with any status or organization. Every real job and quote change already
-- goes through a SECURITY DEFINER function (accept_quote, start_job,
-- finish_job, cancel_job, revise_quote, counter_quote, respond_to_counter,
-- decline_quote, update_request, cancel_request ...) or the Nest API, and
-- those run as the table owner - so taking the direct write privileges away
-- changes nothing for them.
--
-- What the app still writes directly, and is therefore granted back:
--   quotes           - a provider's own new quote (src/api/requests.ts, used
--                      only when the API is not configured)
--   service_requests - a customer's new request (same fallback path)
-- Both are limited to the columns that code sends. status on a new quote
-- takes its default ('sent'), and a new request can only start in one of the
-- opening states and never inside an organization (those go through the API).
--
-- Reads are tightened separately in 0080.

-- Drop the old write policies, whatever they are called in this database, so
-- a stray permissive one (including the old "simulate button" exception)
-- cannot widen the new ones. The privileges revoked below already block these
-- writes; removing the policies as well means a future careless GRANT still
-- finds nothing that allows them (row-level security denies by default).
-- Then recreate exactly what is wanted.
--   jobs             - every write policy (nobody writes jobs directly)
--   quotes           - every insert/update/delete policy (a new one is added below)
--   service_requests - every insert/update/delete policy (a new one is added below)
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('jobs', 'quotes', 'service_requests')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

-- ── jobs: no direct writes at all ───────────────────────────────────────
revoke insert, update, delete on public.jobs from anon, authenticated;

-- ── quotes: a provider can add their own quote, nothing else ────────────
revoke insert, update, delete on public.quotes from anon, authenticated;

grant insert (
  request_id, provider_id, price, eta_label, badge_label, badge_kind, note,
  items, proposed_start
) on public.quotes to authenticated;

create policy "providers send their own quotes" on public.quotes
  for insert to authenticated
  with check (auth.uid() = provider_id);

-- ── service_requests: a customer can open their own request ─────────────
revoke insert, update, delete on public.service_requests from anon, authenticated;

grant insert (
  customer_id, category_id, category_label, description, photos, budget_min,
  budget_max, customer_budget, location_label, preferred_provider_id,
  preferred_time, urgency, request_mode, status
) on public.service_requests to authenticated;

create policy "customers create their own requests" on public.service_requests
  for insert to authenticated
  with check (
    auth.uid() = customer_id
    and status in ('open', 'matching', 'awaiting_provider')
  );

-- ===== 0080_restrict_marketplace_reads.sql =====
-- Requests, quotes, jobs and saved providers: readable only by the people
-- involved.
--
-- These four tables were created with "for select using (true)" (0001) and
-- no role, so anyone holding the public anon key - signed in or not - could
-- read every customer's request text, photos, neighbourhood and budget, every
-- quote price, every job and who hired whom. (payments were fixed in 0041.)
--
-- Who can read what now:
--   service_requests - the customer; the provider it was sent to directly;
--                      providers matched to it (request_opportunities),
--                      who have quoted on it, or who have a job on it; other
--                      members of the customer's organization; admins
--   quotes           - the provider who wrote it; the request's customer or
--                      organization members; admins. Competing providers no
--                      longer see each other's prices.
--   jobs             - the customer and provider; the request's organization
--                      members; admins
--   saved_providers  - the customer who saved them; admins
-- Nothing is readable while signed out.
--
-- The Nest API and the admin site's service-role client are unaffected. The
-- admin pages that read through the signed-in admin's own session keep
-- working because every policy includes is_admin().
--
-- The lookups live in SECURITY DEFINER functions (like is_admin()) so a
-- policy on one table can consult another without re-triggering that table's
-- own policies, which would otherwise recurse.

-- Is the caller the customer behind this request (or in their organization)?
create or replace function public.is_request_owner(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.service_requests r
      where r.id = p_request_id
        and (
          r.customer_id = auth.uid()
          or (
            r.organization_id is not null
            and exists (
              select 1 from public.organization_members m
              where m.organization_id = r.organization_id
                and m.profile_id = auth.uid()
            )
          )
        )
    );
$$;

-- May the caller see this request at all?
create or replace function public.can_view_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.is_admin()
      or public.is_request_owner(p_request_id)
      or exists (
        select 1 from public.service_requests r
        where r.id = p_request_id and r.preferred_provider_id = auth.uid()
      )
      or exists (
        select 1 from public.request_opportunities o
        where o.request_id = p_request_id and o.provider_id = auth.uid()
      )
      or exists (
        select 1 from public.quotes q
        where q.request_id = p_request_id and q.provider_id = auth.uid()
      )
      or exists (
        select 1 from public.jobs j
        where j.request_id = p_request_id
          and (j.provider_id = auth.uid() or j.customer_id = auth.uid())
      )
    );
$$;

revoke all on function public.is_request_owner(uuid) from public, anon;
revoke all on function public.can_view_request(uuid) from public, anon;
grant execute on function public.is_request_owner(uuid) to authenticated, service_role;
grant execute on function public.can_view_request(uuid) to authenticated, service_role;

-- Replace every existing SELECT policy on the four tables (whatever it is
-- called in this database) with the narrow ones below.
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('service_requests', 'quotes', 'jobs', 'saved_providers')
      and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end
$$;

create policy "request parties read requests" on public.service_requests
  for select to authenticated
  using (customer_id = auth.uid() or public.can_view_request(id));

create policy "quote parties read quotes" on public.quotes
  for select to authenticated
  using (
    provider_id = auth.uid()
    or public.is_admin()
    or public.is_request_owner(request_id)
  );

create policy "job parties read jobs" on public.jobs
  for select to authenticated
  using (
    customer_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin()
    or public.is_request_owner(request_id)
  );

create policy "customers read their saved providers" on public.saved_providers
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

-- Signed-out callers get no access to these tables at all.
revoke select on public.service_requests, public.quotes, public.jobs, public.saved_providers from anon;
