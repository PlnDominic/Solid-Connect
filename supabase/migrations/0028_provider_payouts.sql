-- Two-leg payment model. `payments` stays the collection/escrow leg
-- (customer -> Solid Connect, unchanged). `provider_payouts` is the new
-- payout leg (Solid Connect -> provider), net of the platform's
-- commission_percent (platform_config) - created the moment a payment is
-- released, marked paid separately from that. Collecting from the
-- customer and actually sending the provider their cut are two different
-- real-world events with their own timing, method, and reference; one
-- status flip on `payments` was conflating both.

create table public.provider_payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  gross_amount numeric not null,
  commission_amount numeric not null,
  net_amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payout_method text,
  payout_reference text,
  paid_at timestamptz,
  paid_by uuid references public.admins(id),
  created_at timestamptz not null default now(),
  unique (payment_id)
);

create index provider_payouts_provider_idx on public.provider_payouts(provider_id, created_at desc);
create index provider_payouts_status_idx on public.provider_payouts(status);

alter table public.provider_payouts enable row level security;

create policy "providers read their own payouts" on public.provider_payouts
  for select using (auth.uid() = provider_id or public.is_admin());

-- confirm_job_completion, redefined (full body, not a diff - Postgres
-- functions are replaced whole) with one addition: create the pending
-- payout row alongside releasing the payment, computed from the
-- platform's current commission rate at that moment.
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
  where job_id = j.id and status = 'pending'
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  -- Create the payout leg once, the moment the payment is released - not
  -- before (nothing is owed until the customer confirms), and only once
  -- (the unique constraint on payment_id backs this up too).
  if p.id is not null then
    select commission_percent into v_commission from public.platform_config where id = true;
    v_commission := coalesce(v_commission, 15);
    insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount)
    values (
      p.id,
      j.provider_id,
      p.amount,
      round(p.amount * v_commission / 100, 2),
      round(p.amount * (1 - v_commission / 100), 2)
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
