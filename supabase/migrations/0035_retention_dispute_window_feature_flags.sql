-- Solid Connect - items 6, 7, and 14 from the "20 more things" list.
-- (13, the mobile accessibility pass, is application code only - no
-- schema change.)

-- ── 6. Automated data-retention/anonymization job ───────────────────────
-- The privacy policy's concrete, time-bound retention promises are
-- narrower than "anonymize everything eventually": verification
-- documents are kept "for as long as verified or under review, and for a
-- reasonable period after" (docs/legal/privacy-policy.md §5) - so a
-- REJECTED submission's ID documents don't need indefinite storage once
-- that reasonable period has passed. Also sweeps up service_requests
-- that were posted and never matched to anyone - not a privacy concern,
-- just abandoned-data hygiene, using the same terminal state
-- cancel_request() already uses for a customer-initiated cancel.
--
-- Physical file bytes can't be deleted from plain SQL - Supabase's own
-- storage.protect_delete() trigger rejects a direct `delete from
-- storage.objects` with "Use the Storage API instead" specifically to
-- stop a SQL statement from silently orphaning a file at the storage
-- layer. So this function does the part SQL *can* do safely - clear
-- doc_urls, which is the only path the app ever uses to read or serve a
-- document, so access is fully closed the moment this runs - and queues
-- the actual bytes for physical deletion via the real Storage API,
-- which the admin panel's "Storage cleanup" action (Settings, owner-
-- only) carries out with the JS SDK.
create table if not exists public.storage_purge_queue (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  object_path text not null,
  reason text not null,
  queued_at timestamptz not null default now(),
  purged_at timestamptz
);

create index if not exists storage_purge_queue_pending_idx
  on public.storage_purge_queue (bucket_id) where purged_at is null;

alter table public.storage_purge_queue enable row level security;
-- Admin-only, and only ever touched by the service-role client (same as
-- admin_audit_log) - no policy needed for regular users.

create or replace function public.run_data_retention_cleanup()
returns table (rejected_docs_cleared integer, stale_requests_cancelled integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_docs integer := 0;
  v_requests integer := 0;
begin
  insert into public.storage_purge_queue (bucket_id, object_path, reason)
  select 'verification-docs', unnest(doc_urls), 'rejected verification retention (90d)'
  from public.provider_verifications
  where status = 'rejected' and reviewed_at < now() - interval '90 days' and doc_urls <> '{}';

  with cleared as (
    update public.provider_verifications
    set doc_urls = '{}'
    where status = 'rejected' and reviewed_at < now() - interval '90 days' and doc_urls <> '{}'
    returning 1
  )
  select count(*) into v_docs from cleared;

  -- Requests sitting unmatched for 30+ days - nobody has quoted or been
  -- asked directly, so there's nothing for cancel_request()'s own
  -- notification step to do.
  with cancelled as (
    update public.service_requests
    set status = 'cancelled'
    where status in ('open', 'matching') and created_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into v_requests from cancelled;

  return query select v_docs, v_requests;
end;
$$;

revoke all on function public.run_data_retention_cleanup() from public;
grant execute on function public.run_data_retention_cleanup() to service_role;

-- Scheduling this (pg_cron) is a separate migration (0036) - it's a new
-- extension for this project, isolated so a permissions/plan-tier issue
-- enabling it can't roll back the function above or the two items below.

-- ── 7. Dispute filing-window enforcement ─────────────────────────────────
-- refund-dispute-policy.md §2 proposes 48 hours from a job's completion as
-- the filing window - previously written down but not enforced anywhere.
-- Tightened directly on the existing insert policy rather than a new RPC,
-- since the policy already does the "is this really your job" check this
-- just extends. completed_at is null while a job is still in progress
-- (e.g. a no-show dispute filed before either side marks it done), which
-- stays allowed - the window only starts counting once completion date is
-- actually set.
drop policy if exists "customers open disputes on their jobs" on public.disputes;
create policy "customers open disputes on their jobs"
  on public.disputes for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.customer_id = auth.uid()
        and j.provider_id = provider_id
        and (j.completed_at is null or j.completed_at > now() - interval '48 hours')
    )
  );

-- ── 14. Feature flags / staged rollout ───────────────────────────────────
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  -- 0-100: what share of users who pass `enabled` actually get it, via a
  -- deterministic per-user/per-flag hash on the client (see
  -- useFeatureFlag) - not a coin flip on every app open, so nobody's
  -- experience of one flag flickers between sessions.
  rollout_percent integer not null default 0 check (rollout_percent between 0 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admins(id)
);

alter table public.feature_flags enable row level security;

do $$ begin
  create policy "feature flags are publicly readable" on public.feature_flags for select using (true);
exception when duplicate_object then null; end $$;
-- No insert/update/delete policy for regular users - the admin panel
-- writes through the service-role client (createAdminClient), same as
-- every other admin-managed table in this schema.
