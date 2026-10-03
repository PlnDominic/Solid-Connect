-- Phase G: Hubtel collection (customer → platform escrow) then payout.
-- `held` means Hubtel confirmed the customer paid and funds sit with Solid Connect.
-- Job confirmation still moves held|pending → released and creates provider_payouts.

alter table public.payments
  add column if not exists gateway text,
  add column if not exists client_reference text,
  add column if not exists checkout_url text,
  add column if not exists gateway_transaction_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists channel text;

create unique index if not exists payments_client_reference_idx
  on public.payments (client_reference)
  where client_reference is not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'held', 'released', 'refunded', 'partially_refunded'));

-- confirm_job_completion also releases escrow (`held`), not only simulated `pending`.
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
  where job_id = j.id and status in ('pending', 'held')
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  if p.id is not null then
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
