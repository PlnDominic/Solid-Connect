-- Money guards on confirm_job_completion (last defined in 0047).
--
-- 1. An unpaid (`pending`) payment is no longer released when a customer
--    calls this RPC directly. Before, a customer could skip Hubtel, call the
--    RPC to flip the payment to `released` and queue a payout, then hit the
--    API's confirm endpoint, whose "must be paid" check only looks for
--    `pending` - and the API would send the provider real Mobile Money for
--    a job nobody paid for. Only the API (service_role), which has already
--    run its own gateway check, may release a `pending` row (local/dev
--    setups without Hubtel).
-- 2. A provider payout is only queued for a payment that was actually
--    released.
-- 3. An open dispute blocks confirmation for everyone. 0054's payment hold
--    trigger exempts service_role, so confirming through the API used to
--    release a disputed payment anyway.

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
  v_commission numeric;
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

  if exists (select 1 from public.disputes d where d.job_id = j.id and d.status = 'open') then
    raise exception 'PAYMENT_DISPUTED' using errcode = '55000';
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
  where job_id = j.id
    and (status = 'held' or (status = 'pending' and auth.role() = 'service_role'))
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  if p.id is not null and p.status = 'released' then
    select commission_percent into v_commission from public.platform_config where id = true;
    v_commission := coalesce(v_commission, 15);
    insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
    values (
      p.id,
      j.provider_id,
      p.amount,
      round(p.amount * v_commission / 100, 2),
      round(p.amount * (1 - v_commission / 100), 2),
      'hubtel_momo'
    )
    on conflict (payment_id) do nothing;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (
    j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5,
    case when p.status = 'released'
      then 'Customer confirmed completion; payment released'
      else 'Customer confirmed completion; payment not yet received'
    end
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    case when p.status = 'released'
      then 'The customer confirmed completion. Payment was released.'
      else 'The customer confirmed completion. Payment will follow once it is received.'
    end,
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;
