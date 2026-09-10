# Job Live Location — Foundation

Status: approved for planning
Date: 2026-09-10

## Context

This is sub-project 1 of 3 in a larger "mapping system" request: track customer
and provider locations, tied to active jobs, viewable on both the mobile app's
Job Progress screen (sub-project 2) and an admin ops map (sub-project 3). This
spec covers only the foundation both of those depend on: location capture,
storage, authorization, and live delivery. Neither viewing surface is designed
here.

Scoping decisions made during brainstorming, all deliberate (not defaults):

- **Both** customer and provider are tracked, not just the provider - the
  request was explicitly for both sides.
- Tracking is tied to **active jobs only** - never a standing/global
  location feature. A customer or provider not currently on an active job is
  not tracked at all.
- The active window is `accepted` → `in_progress` →
  `awaiting_completion_confirmation`. Tracking stops the moment a job reaches
  `completed`, and that job's location data is deleted, not just stopped.
- Capture is **foreground only** for this first version - no background
  location, no `expo-location` background task, no `Always` permission. This
  keeps the permission ask to the standard "while using the app" tier on both
  iOS and Android, with no app-store background-location review exposure.
  Trade-off: tracking pauses if either party backgrounds the app.

There is no existing live-location infrastructure anywhere in this codebase.
The nearest precedent is the job-mutation RPC pattern established in
`supabase/migrations/0018_job_lifecycle_start_finish.sql` and hardened in
`0022_rpc_auth_hardening.sql` (`start_job`, `finish_job`,
`confirm_job_completion`, etc.) - every job-state-changing action goes through
a `security definer` RPC that independently re-verifies the caller is a party
to that specific job, rather than trusting a raw client-side table write. This
spec follows that same pattern for location writes.

The existing `profiles.location` / `area_centroids` geography columns
(`0012_trust_location.sql`) are unrelated - those are static, area-derived
points used for provider search/matching, not live position.

## Scope

This sub-project covers:

1. A new migration: `job_locations` table (RLS: read-only for the job's own
   two parties and admins; no direct write policy at all), the
   `report_job_location` RPC, a `confirm_job_completion` update to delete the
   row on completion, and adding the table to the `supabase_realtime`
   publication.
2. Mobile: a `useReportJobLocation` hook that watches foreground position
   while a job is in the active window and calls the RPC, throttled.

Out of scope (future sub-projects, not designed here): the mobile Job
Progress map UI, the admin ops map UI, background/always-on tracking, route
history (only the latest position per person is ever stored), and any map
library choice (neither viewing surface is designed yet).

## Data model

New migration, `supabase/migrations/0024_job_live_location.sql`:

```sql
-- Live location for an active job's two parties. One row per job, upserted
-- in place (not a history table - only the latest position matters). Row is
-- deleted the moment the job completes; see confirm_job_completion below.
create table public.job_locations (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  provider_lat double precision,
  provider_lng double precision,
  provider_updated_at timestamptz,
  customer_lat double precision,
  customer_lng double precision,
  customer_updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.job_locations enable row level security;

-- Only the job's own customer/provider, or an admin, can read it. There is
-- deliberately no insert/update/delete policy - every write goes through
-- report_job_location (security definer), which does its own authorization
-- and bypasses RLS by design, the same way every other job mutation does.
create policy "job parties and admins read live location"
  on public.job_locations for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
    or public.is_admin()
  );

create or replace function public.report_job_location(
  p_job_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  j record;
  caller_is_provider boolean;
begin
  select * into j from public.jobs where id = p_job_id;
  if j is null then
    raise exception 'JOB_NOT_FOUND';
  end if;
  if j.status not in ('accepted', 'in_progress', 'awaiting_completion_confirmation') then
    raise exception 'JOB_NOT_ACTIVE';
  end if;

  if auth.uid() = j.provider_id then
    caller_is_provider := true;
  elsif auth.uid() = j.customer_id then
    caller_is_provider := false;
  else
    raise exception 'NOT_A_PARTY_TO_JOB';
  end if;

  insert into public.job_locations (
    job_id, provider_lat, provider_lng, provider_updated_at,
    customer_lat, customer_lng, customer_updated_at
  )
  values (
    p_job_id,
    case when caller_is_provider then p_lat end,
    case when caller_is_provider then p_lng end,
    case when caller_is_provider then now() end,
    case when not caller_is_provider then p_lat end,
    case when not caller_is_provider then p_lng end,
    case when not caller_is_provider then now() end
  )
  on conflict (job_id) do update set
    provider_lat = case when caller_is_provider then excluded.provider_lat else public.job_locations.provider_lat end,
    provider_lng = case when caller_is_provider then excluded.provider_lng else public.job_locations.provider_lng end,
    provider_updated_at = case when caller_is_provider then excluded.provider_updated_at else public.job_locations.provider_updated_at end,
    customer_lat = case when not caller_is_provider then excluded.customer_lat else public.job_locations.customer_lat end,
    customer_lng = case when not caller_is_provider then excluded.customer_lng else public.job_locations.customer_lng end,
    customer_updated_at = case when not caller_is_provider then excluded.customer_updated_at else public.job_locations.customer_updated_at end;
end;
$$;

grant execute on function public.report_job_location to authenticated;

-- confirm_job_completion (redefined here, same signature as 0022) gains one
-- line at the end, after status is set to 'completed': delete the row so no
-- live-location data outlives the job it belonged to.
--   delete from public.job_locations where job_id = j.id;

do $$
begin
  begin
    alter publication supabase_realtime add table public.job_locations;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
```

The `confirm_job_completion` change is a `create or replace` of the existing
function (full body copied from `0022_rpc_auth_hardening.sql` plus the one
new `delete` line), not a diff - Postgres functions are replaced whole.

## Mobile capture (`src/hooks/useReportJobLocation.ts`, new)

```ts
useReportJobLocation(job: Job | null | undefined)
```

- No-ops entirely when `job` is null/undefined or `job.status` is not in the
  active window (`accepted` | `in_progress` | `awaiting_completion_confirmation`).
- On mount (when active), requests foreground permission via
  `Location.requestForegroundPermissionsAsync()`. If denied, does nothing
  further - no retry loop, no blocking UI; the rest of the job flow is
  unaffected. (The calling screen is responsible for any one-time disclosure
  copy shown before the OS prompt - out of scope for this hook.)
- If granted, starts `Location.watchPositionAsync` with
  `{ accuracy: Balanced, timeInterval: 10_000, distanceInterval: 30 }` -
  throttled to roughly every 10 seconds or every ~30 meters moved, whichever
  comes first, to bound both battery drain and RPC call volume.
- Each callback calls `supabase.rpc('report_job_location', { p_job_id,
  p_lat, p_lng })`, fire-and-forget (errors are logged via `console.warn`,
  not surfaced to the user - a missed location update is not worth
  interrupting the job flow over).
- Cleans up (`remove()`s the watch subscription) on unmount and whenever the
  job leaves the active window or `job` becomes null - callers pass the live
  `job` object from `useJob`/`useCustomerActiveJob`/`useProviderJobs` (already
  realtime-updated per earlier work this session), so a job completing
  elsewhere naturally stops this hook without it polling for that itself.

This hook has no consumers yet - sub-projects 2 and 3 call it (mobile: from
whichever screen represents "I am on this active job right now"; there is no
admin-side caller, since admins only read, never report, their own position).

## Error handling & edge cases

- Permission denied: silent no-op, as above. No error state, no re-prompt.
- RPC call fails mid-job (network blip, job just left the active window
  server-side while a stale watch callback was in flight): the RPC itself
  re-validates job status and party membership every call, so a late/invalid
  call simply raises `JOB_NOT_ACTIVE` or `NOT_A_PARTY_TO_JOB`, caught and
  logged, not surfaced.
- Both parties reporting concurrently: each call only ever writes its own
  half of the row (the `case when caller_is_provider ... else
  public.job_locations.<col>` branches), so concurrent provider/customer
  writes can't clobber each other's position.
- Job re-opened or status regresses (not currently possible in this
  codebase's job state machine, but if it ever were): the RPC's status check
  runs fresh on every call, so tracking would simply resume/pause correctly
  without any special-casing needed here.

## Verification plan

No test runner exists in this repo (confirmed for prior specs, still true).
Verified manually against the project's Supabase instance:

- RLS: a customer/provider who isn't a party to a given job cannot `select`
  its `job_locations` row (confirm via a second test account). An admin can
  read any active job's row.
- RPC authorization: calling `report_job_location` as neither party to the
  job raises `NOT_A_PARTY_TO_JOB`; calling it on a `completed` job raises
  `JOB_NOT_ACTIVE`.
- Upsert correctness: provider and customer calls both land, each only
  updating their own columns, confirmed by reading the row after each call.
- Cleanup: the row is gone immediately after `confirm_job_completion` runs.
- Realtime delivery: a `postgres_changes` subscription on `job_locations`
  (same pattern as `useRealtimeInvalidate`) receives an event after a
  `report_job_location` call, confirmed with a throwaway subscription before
  either real viewing surface exists.
