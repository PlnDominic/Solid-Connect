-- Solid Connect no longer collects payment on behalf of providers.
--
-- Customers and providers settle directly (cash or Mobile Money). The
-- platform takes no deposit, holds no balance, charges no commission and
-- makes no payouts. This migration stops the job lifecycle from creating,
-- requiring, releasing or refunding anything in public.payments.
--
-- Nothing is dropped: payments, provider_payouts, deposit settings and every
-- existing row stay in place as an archive (accounting, past disputes). The
-- provider subscription (0081) is unaffected - that is Solid Connect charging
-- providers for its own service, not collecting on their behalf.

-- No deposit gate, deposit amounts or dispute hold on a payment ----------------

drop trigger if exists jobs_require_deposit on public.jobs;
drop trigger if exists payments_set_deposit on public.payments;
drop trigger if exists payments_block_release_during_dispute on public.payments;

-- Accepting a quote or a direct request: a job, without a payment row ----------

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
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CREATED', 0, 1, 'Job created - waiting for provider to start');

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
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created - start work when ready');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '. Agree how you will pay the provider directly. Waiting for them to start.',
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

-- Confirming completion: no payment to release ------------------------------------

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
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    return jsonb_build_object('job', to_jsonb(j));
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

  -- An open dispute has to be settled first.
  if exists (select 1 from public.disputes d where d.job_id = j.id and d.status = 'open') then
    raise exception 'JOB_DISPUTED' using errcode = '55000';
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

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5, 'Customer confirmed completion');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    'The customer confirmed the job is done.',
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j));
end;
$$;

-- Cancelling: nothing to refund or forfeit ----------------------------------------

create or replace function public.cancel_job(
  p_job_id uuid,
  p_reason text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
  v_uid uuid := auth.uid();
  v_is_customer boolean;
  v_other uuid;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_reason not in ('changed_mind', 'provider_unavailable', 'no_show_provider', 'no_show_customer', 'other') then
    raise exception 'INVALID_REASON';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_uid <> j.customer_id and v_uid <> j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_is_customer := (v_uid = j.customer_id);
  v_other := case when v_is_customer then j.provider_id else j.customer_id end;

  if j.status not in ('accepted', 'in_progress') then
    raise exception 'JOB_NOT_CANCELLABLE';
  end if;
  if j.status = 'in_progress' and v_is_customer then
    raise exception 'CANCEL_AFTER_START_USE_DISPUTE';
  end if;

  if p_reason = 'no_show_provider' and not v_is_customer then raise exception 'INVALID_REASON'; end if;
  if p_reason = 'no_show_customer' and v_is_customer then raise exception 'INVALID_REASON'; end if;
  if p_reason like 'no_show%' then
    if j.status <> 'accepted' then raise exception 'NO_SHOW_NOT_ALLOWED'; end if;
    if coalesce(j.scheduled_for, j.started_at) + interval '30 minutes' > now() then
      raise exception 'NO_SHOW_TOO_EARLY';
    end if;
  end if;

  update public.jobs
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancel_reason = p_reason,
      cancel_note = nullif(trim(p_note), '')
  where id = j.id
  returning * into j;

  delete from public.job_locations where job_id = j.id;

  update public.job_reschedules
  set status = 'cancelled', responded_at = now()
  where job_id = j.id and status = 'pending';

  update public.service_requests set status = 'cancelled' where id = j.request_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, v_uid, 'CANCELLED', j.step, j.step, p_reason || coalesce(': ' || nullif(trim(p_note), ''), ''));

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_other,
    'JOB_CANCELLED',
    'Job cancelled',
    case
      when p_reason = 'no_show_customer' then 'The provider reported you did not show up, so this job was cancelled.'
      when p_reason = 'no_show_provider' then 'The customer reported the provider did not show up, so this job was cancelled.'
      else 'The other party cancelled "' || j.title || '".'
    end,
    jsonb_build_object('jobId', j.id, 'requestId', j.request_id, 'reason', p_reason)
  );

  return to_jsonb(j);
end;
$$;

-- "Unpaid balance" reports and payment reminders go away ----------------------------

drop function if exists public.report_unpaid_balance(uuid, text);

-- The hourly job keeps its name (the cron entry calls it) but now only nudges
-- a customer to confirm a finished job. No deposit or balance reminders.
create or replace function public.send_balance_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_sent integer;
begin
  for r in
    select j.id, j.customer_id, j.title, j.provider_completed_at
    from public.jobs j
    where j.status = 'awaiting_completion_confirmation'
      and j.provider_completed_at < now() - interval '24 hours'
      and not exists (select 1 from public.disputes d where d.job_id = j.id)
  loop
    select count(*) into v_sent from public.notifications n
    where n.user_id = r.customer_id and n.type = 'BALANCE_REMINDER' and n.data ->> 'jobId' = r.id::text;

    if (v_sent = 0 or (v_sent = 1 and r.provider_completed_at < now() - interval '48 hours'))
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.customer_id and n.type = 'BALANCE_REMINDER'
           and n.data ->> 'jobId' = r.id::text and n.created_at > now() - interval '20 hours'
       ) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'BALANCE_REMINDER',
        'Confirm your job',
        '"' || r.title || '" is finished. Confirm it once you are happy with the work.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;
end;
$$;

-- Chat no longer claims "all payments go through Solid Connect" ---------------------
-- 0071/0072 strip bank and mobile money details from chat messages and leave
-- a placeholder saying every payment goes through Solid Connect. Payment is
-- now direct, so only that placeholder text changes (the rules are untouched).
do $$
declare
  def text;
begin
  if to_regprocedure('public.strip_contact_details_from_message()') is not null then
    def := pg_get_functiondef('public.strip_contact_details_from_message()'::regprocedure);
    if position('Account details removed - all payments go through Solid Connect' in def) > 0 then
      execute replace(def, 'Account details removed - all payments go through Solid Connect', 'Account details removed');
    end if;
  end if;
end
$$;
