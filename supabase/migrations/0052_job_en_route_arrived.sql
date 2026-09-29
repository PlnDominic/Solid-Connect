-- "On my way" / "I've arrived": two provider check-ins before work starts.
--
-- Deliberately timestamps on jobs, not new job_status values: the status
-- enum is checked by every job RPC and the client, and these are only
-- sub-states of 'accepted'. Each check-in notifies the customer through the
-- notifications table, which the 0043 trigger delivers as a push.

alter table public.jobs
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz;

create or replace function public.mark_en_route(
  p_job_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_ACCEPTED'; end if;

  -- Idempotent: a second tap (or a retry) changes nothing and re-notifies nobody.
  if j.en_route_at is not null then
    return to_jsonb(j);
  end if;

  update public.jobs set en_route_at = now() where id = j.id returning * into j;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_EN_ROUTE',
    'Your provider is on the way',
    'Open the job to follow them live.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

create or replace function public.mark_arrived(
  p_job_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_ACCEPTED'; end if;

  if j.arrived_at is not null then
    return to_jsonb(j);
  end if;

  -- Arriving implies being on the way, even if "on my way" was skipped.
  update public.jobs
  set arrived_at = now(), en_route_at = coalesce(en_route_at, now())
  where id = j.id
  returning * into j;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_ARRIVED',
    'Your provider has arrived',
    'They are at your location.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

grant execute on function public.mark_en_route to service_role, authenticated;
grant execute on function public.mark_arrived to service_role, authenticated;
