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
