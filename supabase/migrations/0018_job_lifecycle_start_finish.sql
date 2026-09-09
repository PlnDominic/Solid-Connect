-- Simple job lifecycle:
-- accepted → in_progress (provider starts)
-- in_progress → awaiting_completion_confirmation (provider finishes)
-- awaiting_completion_confirmation → completed (customer confirms)

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status = any (array[
    'accepted'::text,
    'in_progress'::text,
    'awaiting_completion_confirmation'::text,
    'completed'::text
  ]));

-- New jobs start as accepted (not yet working). Existing active jobs stay in_progress.
-- Direct/quote accept functions updated below to insert status = accepted.

alter table public.job_events drop constraint if exists job_events_event_type_check;
alter table public.job_events
  add constraint job_events_event_type_check
  check (event_type = any (array[
    'CREATED'::text,
    'STARTED'::text,
    'FINISHED'::text,
    'STEP_ADVANCED'::text,
    'PROVIDER_COMPLETED'::text,
    'CUSTOMER_CONFIRMED'::text,
    'MESSAGE_HINT'::text
  ]));

create or replace function public.start_job(
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
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;
  if j.status = 'awaiting_completion_confirmation' then raise exception 'JOB_AWAITING_CUSTOMER'; end if;
  if j.status = 'in_progress' then
    return to_jsonb(j);
  end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_STARTABLE'; end if;

  update public.jobs
  set
    status = 'in_progress',
    step = greatest(step, 2),
    started_at = coalesce(started_at, now())
  where id = j.id
  returning * into j;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'STARTED', 1, j.step, 'Provider started work');

  return to_jsonb(j);
end;
$$;

create or replace function public.finish_job(
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
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;
  if j.status = 'awaiting_completion_confirmation' then
    return to_jsonb(j);
  end if;
  if j.status <> 'in_progress' then raise exception 'JOB_NOT_IN_PROGRESS'; end if;

  update public.jobs
  set
    status = 'awaiting_completion_confirmation',
    step = 5,
    provider_completed_at = now()
  where id = j.id
  returning * into j;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'FINISHED', 2, 5, 'Provider finished work — awaiting customer confirmation');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_AWAITING_CONFIRMATION',
    'Confirm job completion',
    'Your provider marked the job finished. Confirm to release payment.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

-- Keep advance_job as a thin alias: start if accepted, else finish if in_progress.
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
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.status = 'accepted' then
    return public.start_job(p_job_id, p_provider_id);
  end if;
  if j.status = 'in_progress' then
    return public.finish_job(p_job_id, p_provider_id);
  end if;
  if j.status = 'awaiting_completion_confirmation' then
    raise exception 'JOB_AWAITING_CUSTOMER';
  end if;
  if j.status = 'completed' then
    raise exception 'JOB_ALREADY_COMPLETED';
  end if;
  raise exception 'JOB_NOT_ADVANCEABLE';
end;
$$;

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

-- New jobs from quote accept start as accepted (provider must Start work).
create or replace function public.accept_quote(
  p_quote_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
  j public.jobs%rowtype;
  title text;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;

  select * into r from public.service_requests where id = q.request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.customer_id <> p_customer_id then raise exception 'NOT_REQUEST_OWNER'; end if;
  if r.status not in ('matching', 'quoted', 'open', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  if exists (select 1 from public.jobs j2 where j2.quote_id = q.id) then
    select * into j from public.jobs where quote_id = q.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
  end if;

  update public.quotes set status = 'accepted', updated_at = now() where id = q.id;
  update public.quotes
    set status = 'declined', updated_at = now()
    where request_id = r.id and id <> q.id and status = 'sent';
  update public.service_requests set status = 'accepted' where id = r.id;

  update public.request_opportunities
    set status = 'QUOTED'
    where request_id = r.id and provider_id = q.provider_id;

  title := trim(split_part(r.category_label, '·', 2));
  if title = '' then title := r.category_label; end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, q.provider_id, title, q.price, r.location_label, 1, 'accepted'
  )
  returning * into j;

  insert into public.payments (job_id, amount, status)
  values (j.id, q.price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CREATED', 0, 1, 'Job created — waiting for provider to start');

  select * into q from public.quotes where id = p_quote_id;
  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

create or replace function public.accept_direct_request(
  p_request_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.service_requests%rowtype;
  q public.quotes%rowtype;
  j public.jobs%rowtype;
  title text;
  price integer;
begin
  select * into r from public.service_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.request_mode <> 'DIRECT' or r.preferred_provider_id is distinct from p_provider_id then
    raise exception 'NOT_DIRECT_PROVIDER';
  end if;
  if r.status <> 'awaiting_provider' then raise exception 'REQUEST_NOT_AWAITING'; end if;

  price := coalesce(r.customer_budget, r.budget_min, r.budget_max);
  if price is null or price <= 0 then raise exception 'INVALID_BUDGET'; end if;

  if exists (select 1 from public.jobs j2 where j2.request_id = r.id) then
    select * into j from public.jobs where request_id = r.id limit 1;
    select * into q from public.quotes where id = j.quote_id;
    return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
  end if;

  insert into public.quotes (
    request_id, provider_id, price, eta_label, badge_label, badge_kind, status, note, revision
  ) values (
    r.id, p_provider_id, price, 'As agreed', 'Direct hire', 'verified', 'accepted', 'Accepted direct request', 1
  )
  returning * into q;

  update public.service_requests set status = 'accepted' where id = r.id;

  update public.request_opportunities
    set status = 'QUOTED'
    where request_id = r.id and provider_id = p_provider_id;

  title := trim(split_part(r.category_label, '·', 2));
  if title = '' then title := r.category_label; end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, p_provider_id, title, price, r.location_label, 1, 'accepted'
  )
  returning * into j;

  insert into public.payments (job_id, amount, status)
  values (j.id, price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created — start work when ready');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '. Waiting for the provider to start.',
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

grant execute on function public.start_job to service_role, authenticated;
grant execute on function public.finish_job to service_role, authenticated;
grant execute on function public.advance_job to service_role, authenticated;
grant execute on function public.confirm_job_completion to service_role, authenticated;
grant execute on function public.accept_quote to service_role, authenticated;
grant execute on function public.accept_direct_request to service_role, authenticated;
