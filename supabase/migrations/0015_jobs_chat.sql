-- Phase F: job events, completion RPCs, chat participant helpers.

alter table public.jobs
  add column if not exists provider_completed_at timestamptz;

alter table public.jobs
  add column if not exists customer_confirmed_at timestamptz;

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null
    check (event_type in (
      'CREATED',
      'STEP_ADVANCED',
      'PROVIDER_COMPLETED',
      'CUSTOMER_CONFIRMED',
      'MESSAGE_HINT'
    )),
  from_step integer,
  to_step integer,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists job_events_job_idx on public.job_events (job_id, created_at);

alter table public.job_events enable row level security;

do $$ begin
  create policy "job participants read events"
    on public.job_events for select
    using (
      exists (
        select 1 from public.jobs j
        where j.id = job_id and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
      )
      or public.is_admin()
    );
exception when duplicate_object then null; end $$;

-- Provider advances job step; at step 5 marks provider_completed (awaits customer confirm).
create or replace function public.advance_job(
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
  next_step integer;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;
  if j.provider_completed_at is not null or j.step >= 5 then raise exception 'JOB_AWAITING_CUSTOMER'; end if;

  next_step := least(5, j.step + 1);

  update public.jobs
  set
    step = next_step,
    provider_completed_at = case when next_step >= 5 then now() else provider_completed_at end,
    status = 'in_progress'
  where id = j.id
  returning * into j;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (
    j.id,
    p_provider_id,
    case when next_step >= 5 then 'PROVIDER_COMPLETED' else 'STEP_ADVANCED' end,
    next_step - 1,
    next_step,
    case when next_step >= 5 then 'Provider marked work complete' else 'Step advanced' end
  );

  return to_jsonb(j);
end;
$$;

grant execute on function public.advance_job to service_role, authenticated;

-- Customer confirms completion and releases escrowed payment.
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
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    select * into p from public.payments where job_id = j.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
  end if;
  if j.step < 5 and j.provider_completed_at is null then
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

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id and status = 'pending'
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5, 'Customer confirmed completion; payment released');

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;

grant execute on function public.confirm_job_completion to service_role, authenticated;

-- Ensure realtime can deliver chat inserts to participants (idempotent).
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
