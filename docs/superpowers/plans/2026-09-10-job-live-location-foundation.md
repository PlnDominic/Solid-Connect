# Job Live Location Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a job's customer and provider each report their live (foreground-only) position while the job is active, stored server-side, deleted the moment the job completes, and delivered live to any subscriber via Supabase Realtime — the shared foundation two later sub-projects (a mobile Job Progress map, an admin ops map) will build viewing UI on top of.

**Architecture:** One new Postgres table (`job_locations`, one row per job, upserted) with RLS restricted to that job's two parties plus admins; all writes go through a new `security definer` RPC (`report_job_location`) that independently re-verifies the caller's identity and the job's status on every call, following this codebase's existing hardened-RPC convention (`0018_job_lifecycle_start_finish.sql`, `0022_rpc_auth_hardening.sql`). `confirm_job_completion` gains one line to delete the row on completion. A new mobile hook (`useReportJobLocation`) drives `expo-location`'s foreground position watcher and calls the RPC while a job is in its active window.

**Tech Stack:** Supabase (Postgres, RLS, Realtime, RPC), Expo SDK 57 (`expo-location`), TypeScript, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-09-10-job-live-location-foundation-design.md`

## Global Constraints

- Active job window (from the spec): `accepted`, `in_progress`, `awaiting_completion_confirmation`. Never `completed`.
- Capture is foreground-only — no background location, no `Always` permission, no background task.
- Only the latest position per person is ever stored (no history table).
- No test runner exists in this repo — verification is manual: a throwaway Node script against the live Supabase instance for SQL/RPC work (delete the script when done, it's not part of the deliverable), and `tsc --noEmit` + a spec-checklist read-through for mobile code.
- One deviation from the spec, decided while planning (does not change any of the spec's security/scope decisions): `report_job_location` gains a fourth parameter, `p_as_provider boolean default null`, used only when the caller is `service_role` — every other hardened RPC in this codebase (`start_job`, `accept_quote`, etc.) already allows a `service_role` caller to bypass the `auth.uid()` ownership check for exactly this kind of backend/testing use; this function's two-sided (provider-or-customer) shape needs an explicit flag to say which side a service-role call represents, since there's no `auth.uid()` to infer it from. Real end-user calls are unaffected — their side is still always inferred from `auth.uid()`, never from a client-supplied flag.
- **Known, deliberate gap in Task 1's verification:** the service-role client used for all automated checks bypasses RLS entirely and, once `p_as_provider` is supplied, bypasses the `auth.uid()` party check too - so the `NOT_A_PARTY_TO_JOB` branch and cross-user RLS `SELECT` denial (an unrelated real user can't read or write another job's location) are genuinely untested by Task 1's script. Closing that gap properly needs a real, non-service-role authenticated session (throwaway auth users + sign-in + cleanup), which is disproportionate machinery for this foundation-only plan and carries its own risk (creating/deleting real auth users against production). It's deferred to sub-project 2 (mobile), where real logged-in test accounts will exist naturally and this boundary can be exercised end-to-end for real - explicitly flag this when that plan is written, don't let it get silently dropped.

---

### Task 1: Migration — `job_locations` table, RPC, cleanup hook, realtime, types

**Files:**
- Create: `supabase/migrations/0024_job_live_location.sql`
- Modify: `src/types/database.ts` (add `JobLocation` interface + `Database.public.Tables.job_locations` entry, matching the existing per-table pattern)
- Test: a throwaway Node script (not committed) run from the `admin/` directory, where `@supabase/supabase-js` and `.env.local`'s service-role key already live

**Interfaces:**
- Produces: `public.report_job_location(p_job_id uuid, p_lat double precision, p_lng double precision, p_as_provider boolean default null) returns void` — callable by any `authenticated` user; table `public.job_locations` (columns: `job_id`, `provider_lat`, `provider_lng`, `provider_updated_at`, `customer_lat`, `customer_lng`, `customer_updated_at`, `created_at`); TS type `JobLocation` in `src/types/database.ts`.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0024_job_live_location.sql`:

```sql
-- Live location for an active job's two parties. One row per job, upserted
-- in place (not a history table - only the latest position matters). Row is
-- deleted the moment the job completes (see the confirm_job_completion
-- redefinition below), so no live-location data outlives the job.

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
  p_lng double precision,
  p_as_provider boolean default null
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

  if auth.role() = 'service_role' then
    if p_as_provider is null then
      raise exception 'AS_PROVIDER_REQUIRED';
    end if;
    caller_is_provider := p_as_provider;
  elsif auth.uid() = j.provider_id then
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

-- confirm_job_completion, redefined (full body, not a diff - Postgres
-- functions are replaced whole) with one new line: once the job is marked
-- completed, delete its live-location row.
create or replace function public.confirm_job_completion(
  p_job_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
  p public.payments%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    select * into p from public.payments where job_id = j.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
  end if;
  if j.status <> 'awaiting_completion_confirmation'
     and j.provider_completed_at is null
     and j.step < 5 then
    raise exception 'JOB_NOT_READY';
  end if;
  if j.status not in ('awaiting_completion_confirmation', 'in_progress')
     and j.provider_completed_at is null then
    raise exception 'JOB_NOT_READY';
  end if;

  update public.jobs
  set
    status = 'completed',
    step = 5,
    completed_at = coalesce(completed_at, now()),
    customer_confirmed_at = now(),
    provider_completed_at = coalesce(provider_completed_at, now())
  where id = j.id
  returning * into j;

  delete from public.job_locations where job_id = j.id;

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id and status = 'pending'
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5, 'Customer confirmed completion; payment released');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    'The customer confirmed completion. Payment was released.',
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;

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

- [ ] **Step 2: Apply the migration (human action required)**

This environment has no `DATABASE_URL`/`psql` access — every prior migration in this project was applied the same way. Ask the user to run the SQL from Step 1 in the Supabase Dashboard → SQL Editor, on the `main` (production) project, then confirm back that it ran without error before continuing.

- [ ] **Step 3: Add the TS type**

In `src/types/database.ts`, add near the other per-table interfaces (e.g. after `Dispute`):

```ts
export interface JobLocation {
  job_id: string;
  provider_lat: number | null;
  provider_lng: number | null;
  provider_updated_at: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  customer_updated_at: string | null;
  created_at: string;
}
```

And in `Database.public.Tables` (after the `provider_portfolio_photos` line):

```ts
job_locations: { Row: JobLocation; Insert: Partial<JobLocation> & { job_id: string }; Update: Partial<JobLocation> };
```

- [ ] **Step 4: Write the verification script**

Create (do not commit) `admin/_verify-0024.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) throw new Error('FAILED: ' + message);
  console.log('OK:', message);
}

// 1. Table exists.
{
  const { error } = await supabase.from('job_locations').select('*', { count: 'exact', head: true });
  assert(!error, 'job_locations table exists (' + (error?.message ?? 'no error') + ')');
}

// 2. Find one real provider and one real customer from seed data to build a
// disposable job with.
const { data: provider } = await supabase.from('profiles').select('id').eq('role', 'provider').limit(1).single();
const { data: customer } = await supabase.from('profiles').select('id').eq('role', 'customer').limit(1).single();
assert(!!provider && !!customer, 'found a seed provider and customer to test with');

// 3. Build a disposable request -> quote -> job (via the real RPC chain, as
// service_role, which every hardened RPC in this codebase explicitly
// allows) so the whole path - including the new confirm_job_completion
// delete line - gets exercised against real, well-formed data.
const { data: request, error: reqErr } = await supabase
  .from('service_requests')
  .insert({ customer_id: customer.id, category_label: '__test__ · location foundation check' })
  .select('id')
  .single();
assert(!reqErr, 'created disposable service_request (' + (reqErr?.message ?? '') + ')');

const { data: quote, error: quoteErr } = await supabase
  .from('quotes')
  .insert({ request_id: request.id, provider_id: provider.id, price: 100 })
  .select('id')
  .single();
assert(!quoteErr, 'created disposable quote (' + (quoteErr?.message ?? '') + ')');

const { data: acceptResult, error: acceptErr } = await supabase.rpc('accept_quote', {
  p_quote_id: quote.id,
  p_customer_id: customer.id,
});
assert(!acceptErr, 'accept_quote succeeded (' + (acceptErr?.message ?? '') + ')');
const jobId = acceptResult.job.id;

try {
  // 4. Job is 'accepted' - active. Test JOB_NOT_ACTIVE does NOT fire yet,
  // and that NOT_A_PARTY_TO_JOB fires when no party is identified (calling
  // without p_as_provider as service_role hits AS_PROVIDER_REQUIRED first -
  // test that specific branch here).
  {
    const { error } = await supabase.rpc('report_job_location', { p_job_id: jobId, p_lat: 5.6, p_lng: -0.2 });
    assert(error?.message?.includes('AS_PROVIDER_REQUIRED'), 'service_role call without p_as_provider is rejected');
  }

  // 5. Report as provider, then as customer; confirm each write only ever
  // touches its own half of the row.
  {
    const { error } = await supabase.rpc('report_job_location', {
      p_job_id: jobId, p_lat: 5.6, p_lng: -0.2, p_as_provider: true,
    });
    assert(!error, 'provider report succeeded (' + (error?.message ?? '') + ')');
  }
  {
    const { error } = await supabase.rpc('report_job_location', {
      p_job_id: jobId, p_lat: 5.61, p_lng: -0.21, p_as_provider: false,
    });
    assert(!error, 'customer report succeeded (' + (error?.message ?? '') + ')');
  }
  {
    const { data: row, error } = await supabase.from('job_locations').select('*').eq('job_id', jobId).single();
    assert(!error, 'row readable after both reports');
    assert(row.provider_lat === 5.6 && row.provider_lng === -0.2, 'provider half has provider values');
    assert(row.customer_lat === 5.61 && row.customer_lng === -0.21, 'customer half has customer values');
  }

  // 6. Drive the job to completed, then confirm the row is gone.
  {
    const { error } = await supabase.rpc('start_job', { p_job_id: jobId, p_provider_id: provider.id });
    assert(!error, 'start_job succeeded (' + (error?.message ?? '') + ')');
  }
  {
    const { error } = await supabase.rpc('finish_job', { p_job_id: jobId, p_provider_id: provider.id });
    assert(!error, 'finish_job succeeded (' + (error?.message ?? '') + ')');
  }
  {
    const { error } = await supabase.rpc('confirm_job_completion', { p_job_id: jobId, p_customer_id: customer.id });
    assert(!error, 'confirm_job_completion succeeded (' + (error?.message ?? '') + ')');
  }
  {
    const { data: row, error } = await supabase.from('job_locations').select('*').eq('job_id', jobId).maybeSingle();
    assert(!error && !row, 'job_locations row deleted after job completion');
  }
  {
    const { error } = await supabase.rpc('report_job_location', {
      p_job_id: jobId, p_lat: 5.6, p_lng: -0.2, p_as_provider: true,
    });
    assert(error?.message?.includes('JOB_NOT_ACTIVE'), 'reporting on a completed job is rejected');
  }

  console.log('\nAll checks passed.');
} finally {
  // Clean up every disposable row this script created.
  await supabase.from('job_locations').delete().eq('job_id', jobId);
  await supabase.from('payments').delete().eq('job_id', jobId);
  await supabase.from('job_events').delete().eq('job_id', jobId);
  await supabase.from('chat_threads').delete().eq('job_id', jobId);
  await supabase.from('jobs').delete().eq('id', jobId);
  await supabase.from('quotes').delete().eq('id', quote.id);
  await supabase.from('service_requests').delete().eq('id', request.id);
  console.log('Cleaned up disposable test rows.');
}
```

- [ ] **Step 5: Run it**

```bash
cd admin && node _verify-0024.mjs
```

Expected: every line prefixed `OK:`, ending with `All checks passed.` and `Cleaned up disposable test rows.`. If anything prints `FAILED:` or throws, stop and fix the migration (or this script, if the script's assumption was wrong) before continuing - do not proceed to Step 6 with a failing check.

- [ ] **Step 6: Delete the throwaway script**

```bash
rm admin/_verify-0024.mjs
```

It is not part of the deliverable - it exists only to exercise the migration once, live, against real (if disposable) data.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0024_job_live_location.sql src/types/database.ts
git commit -m "Add job_locations table, report_job_location RPC, and delete-on-completion cleanup"
```

---

### Task 2: Mobile foreground location capture hook

**Files:**
- Modify: `package.json`, `package-lock.json` (add `expo-location`)
- Modify: `app.json` (register the `expo-location` config plugin)
- Create: `src/hooks/useReportJobLocation.ts`

**Interfaces:**
- Consumes: `Job` and `JobStatus` from `src/types/database.ts` (Task 1); `supabase` client from `src/lib/supabase.ts`.
- Produces: `useReportJobLocation(job: Job | null | undefined): void` — no return value, purely an effect. Has no consumers in this plan; sub-projects 2 and 3 (not designed yet) will call it from whichever screen represents "I am on this active job right now."

- [ ] **Step 1: Install expo-location**

```bash
npx expo install expo-location
```

Expected: `package.json`'s `dependencies` gains an `expo-location` entry at the version Expo's install command resolves for SDK 57 (uses `npx expo install`, not plain `npm install`, so the version is compatible with the installed Expo SDK - matching how every other Expo package in this project was added).

- [ ] **Step 2: Register the config plugin**

In `app.json`, change:

```json
"plugins": ["expo-apple-authentication", "expo-notifications"],
```

to:

```json
"plugins": [
  "expo-apple-authentication",
  "expo-notifications",
  [
    "expo-location",
    {
      "locationWhenInUsePermission": "Solid Connect shares your location with your provider or customer only while a job is active."
    }
  ]
],
```

- [ ] **Step 3: Write the hook**

Create `src/hooks/useReportJobLocation.ts`:

```ts
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import type { Job, JobStatus } from '../types/database';

const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['accepted', 'in_progress', 'awaiting_completion_confirmation'];

/**
 * Reports the signed-in user's foreground position to report_job_location
 * while `job` is in one of the active statuses, throttled to roughly every
 * 10s or every ~30m moved (iOS only honors the distance filter - timeInterval
 * is Android-only per Expo's Location API, so distanceInterval is what
 * actually bounds iOS update frequency).
 *
 * No-ops entirely (and stops any running watch) as soon as `job` is null or
 * leaves the active window - pass a live, realtime-updated Job (e.g. from
 * useJob/useCustomerActiveJob/useProviderJobs) so a job completing
 * elsewhere stops this automatically, without this hook needing to poll
 * for that itself.
 *
 * Permission denial is a silent no-op: the rest of the job flow is
 * unaffected, and there is no retry loop or blocking UI here. The calling
 * screen owns any one-time disclosure copy shown before the OS prompt.
 */
export function useReportJobLocation(job: Job | null | undefined) {
  const jobId = job?.id;
  const isActive = !!job && ACTIVE_JOB_STATUSES.includes(job.status);

  useEffect(() => {
    if (!isActive || !jobId) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,
          distanceInterval: 30,
        },
        (position) => {
          supabase
            .rpc('report_job_location', {
              p_job_id: jobId,
              p_lat: position.coords.latitude,
              p_lng: position.coords.longitude,
            })
            .then(({ error }) => {
              if (error) console.warn('[useReportJobLocation] report failed:', error.message);
            });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isActive, jobId]);
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors from `src/hooks/useReportJobLocation.ts`. (Pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern - confirm none are newly introduced by this file.)

- [ ] **Step 5: Verify against the spec checklist**

No test runner or live consumer exists yet for this hook (both are later sub-projects), so verification here is a deliberate read-through, not an automated run. Confirm, by reading the file back:

- No-ops when `job` is `null`/`undefined`. ✓ (`!!job` short-circuits `isActive`)
- No-ops outside the three active statuses. ✓ (`ACTIVE_JOB_STATUSES.includes`)
- Requests foreground-only permission, never background. ✓ (`requestForegroundPermissionsAsync`, no `requestBackgroundPermissionsAsync` anywhere)
- Denial doesn't throw or block. ✓ (returns silently on non-`'granted'`)
- Stops watching on unmount or when the job leaves the active window. ✓ (effect cleanup calls `subscription?.remove()`, `useEffect` re-runs the whole setup/teardown whenever `isActive`/`jobId` change)
- RPC errors are logged, not surfaced to the user. ✓ (`console.warn`, no thrown/re-thrown error, no state update)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json src/hooks/useReportJobLocation.ts
git commit -m "Add useReportJobLocation: foreground GPS capture for active jobs"
```
