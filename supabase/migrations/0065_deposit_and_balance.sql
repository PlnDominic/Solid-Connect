-- Deposit + balance, both paid to Solid Connect.
--
-- Customers never pay providers directly. A booking is secured by a deposit
-- (platform_config.deposit_percent of the price, default 30%) paid through
-- Hubtel; the balance is paid after the provider finishes; Solid Connect
-- releases the whole amount, minus commission, when the customer confirms.
--
--   pending      - nothing paid; the provider can't travel or start
--   deposit_held - deposit received; booking secured
--   held         - deposit + balance received; customer can confirm
--   released     - paid out to the provider
--   forfeited    - customer cancelled after paying the deposit; kept, with
--                  cancel_compensation_percent of it paid to the provider
--   refunded / partially_refunded - as before (refunds are actioned by ops)
--
-- deposit_percent = 0 turns deposits off (one payment, as before) - use it
-- for setups without Hubtel.

-- ── Settings ────────────────────────────────────────────────────────────
alter table public.platform_config
  add column if not exists deposit_percent numeric not null default 30
    check (deposit_percent between 0 and 100),
  add column if not exists cancel_compensation_percent numeric not null default 50
    check (cancel_compensation_percent between 0 and 100);

-- ── Payment columns ─────────────────────────────────────────────────────
-- Existing rows get deposit_amount 0: bookings made before this change
-- carry on as single payments.
alter table public.payments
  add column if not exists deposit_amount integer not null default 0 check (deposit_amount >= 0),
  add column if not exists deposit_reference text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_transaction_id text;

create unique index if not exists payments_deposit_reference_idx
  on public.payments (deposit_reference) where deposit_reference is not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'deposit_held', 'held', 'released', 'refunded', 'partially_refunded', 'forfeited'));

-- Every new booking's payment gets its deposit from the current setting.
-- accept_quote / accept_direct_request create the row, so neither needs to
-- change.
create or replace function public.set_payment_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct numeric;
begin
  select deposit_percent into v_pct from public.platform_config where id = true;
  new.deposit_amount := round(new.amount * coalesce(v_pct, 30) / 100);
  return new;
end;
$$;

drop trigger if exists payments_set_deposit on public.payments;
create trigger payments_set_deposit
  before insert on public.payments
  for each row execute function public.set_payment_deposit();

-- ── No travel or work before the deposit ────────────────────────────────
create or replace function public.require_deposit_before_work()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'in_progress' and old.status is distinct from 'in_progress')
     or (new.en_route_at is not null and old.en_route_at is null)
     or (new.arrived_at is not null and old.arrived_at is null) then
    if exists (
      select 1 from public.payments p
      where p.job_id = new.id
        and p.deposit_amount > 0
        and p.status = 'pending'
    ) then
      raise exception 'DEPOSIT_REQUIRED' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_require_deposit on public.jobs;
create trigger jobs_require_deposit
  before update on public.jobs
  for each row execute function public.require_deposit_before_work();

-- ── Confirmation needs the full amount ──────────────────────────────────
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
    -- Fully paid (deposit + balance). Only the API (service_role), which has
    -- run its own gateway check, may release a partly paid row - that only
    -- happens on setups without Hubtel.
    and (status = 'held' or (status in ('pending', 'deposit_held') and auth.role() = 'service_role'))
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

-- ── Cancelling after the deposit ────────────────────────────────────────
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
  v_customer_side boolean;
  p public.payments%rowtype;
  v_comp_pct numeric;
  v_comp numeric;
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

  -- The customer's money goes back unless the customer was the no-show;
  -- that case stays pending for an admin to decide (e.g. a call-out fee).
  -- Money. Who carries the cost of a cancelled booking: the customer when
  -- they back out (any cancellation by the customer except a provider
  -- no-show, or the provider reporting the customer didn't show), the
  -- provider otherwise. A customer whose provider is unavailable should
  -- report a no-show or open a dispute; admins can still refund.
  v_customer_side := (v_is_customer and p_reason <> 'no_show_provider') or p_reason = 'no_show_customer';

  select * into p from public.payments where job_id = j.id limit 1 for update;
  if found then
    if p.status = 'pending' then
      -- Nothing was paid; just close the ledger row.
      if p_reason <> 'no_show_customer' then
        update public.payments
        set status = 'refunded',
            refund_reason = 'Job cancelled (' || p_reason || ')',
            refund_amount = null
        where id = p.id;
      end if;
    elsif p.status = 'deposit_held' then
      if v_customer_side then
        -- Deposit kept by Solid Connect; part of it compensates the provider.
        select cancel_compensation_percent into v_comp_pct from public.platform_config where id = true;
        v_comp := round(p.deposit_amount * coalesce(v_comp_pct, 50) / 100, 2);
        update public.payments
        set status = 'forfeited',
            refund_reason = 'Deposit kept: customer cancelled (' || p_reason || ')',
            refund_amount = null
        where id = p.id;
        if v_comp > 0 then
          insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
          values (p.id, j.provider_id, p.deposit_amount, p.deposit_amount - v_comp, v_comp, 'hubtel_momo')
          on conflict (payment_id) do nothing;
          insert into public.notifications (user_id, type, title, body, data)
          values (
            j.provider_id,
            'CANCELLATION_COMPENSATION',
            'Cancellation compensation',
            'The customer cancelled after paying a deposit. You will receive GHS ' || v_comp || '.',
            jsonb_build_object('jobId', j.id)
          );
        end if;
      else
        -- Provider's side: the customer gets the deposit back (paid out by ops).
        update public.payments
        set status = 'refunded',
            refund_reason = 'Deposit refund due: job cancelled (' || p_reason || ')',
            refund_amount = p.deposit_amount
        where id = p.id;
      end if;
    elsif p.status = 'held' then
      -- Paid in full before cancelling (older bookings): refund due, ops decide.
      update public.payments
      set status = 'refunded',
          refund_reason = 'Refund due: job cancelled (' || p_reason || ')',
          refund_amount = null
      where id = p.id;
    end if;
  end if;

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

-- ── Provider escalation: unpaid balance ─────────────────────────────────
alter table public.disputes drop constraint if exists disputes_reason_check;
alter table public.disputes
  add constraint disputes_reason_check
  check (reason in ('not_completed', 'poor_quality', 'overcharged', 'no_show', 'other', 'unpaid_balance'));

-- 72 hours after the provider finishes, if the customer still hasn't paid
-- the balance and confirmed, the provider can hand it to Solid Connect.
-- Opens the job's dispute (one per job); the deposit stays held meanwhile.
create or replace function public.report_unpaid_balance(p_job_id uuid, p_note text default '')
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
  d public.disputes%rowtype;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if auth.uid() is distinct from j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if j.status <> 'awaiting_completion_confirmation' then raise exception 'JOB_NOT_AWAITING_PAYMENT'; end if;
  if j.provider_completed_at is null or j.provider_completed_at > now() - interval '72 hours' then
    raise exception 'TOO_EARLY_TO_REPORT';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into d from public.disputes where job_id = j.id limit 1;
  if found then raise exception 'DISPUTE_EXISTS'; end if;

  insert into public.disputes (job_id, customer_id, provider_id, reason, description)
  values (
    j.id, j.customer_id, j.provider_id, 'unpaid_balance',
    coalesce(nullif(trim(p_note), ''), 'The provider finished the job but the balance has not been paid or the job confirmed.')
  )
  returning * into d;
  return d;
end;
$$;

revoke all on function public.report_unpaid_balance(uuid, text) from public, anon;
grant execute on function public.report_unpaid_balance(uuid, text) to authenticated;

-- A provider-reported unpaid balance notifies the customer, not the provider.
create or replace function public.dispute_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Money already gone before the dispute was filed: nothing to hold, but
  -- ops need to know.
  update public.disputes d
  set payment_already_released = exists (
    select 1 from public.payments p where p.job_id = d.job_id and p.status = 'released'
  )
  where d.id = new.id;

  -- A provider reporting an unpaid balance: tell the customer instead.
  if new.reason = 'unpaid_balance' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.customer_id,
      'BALANCE_UNPAID_REPORTED',
      'Unpaid balance reported',
      'The provider reported the balance for this job as unpaid. Solid Connect will review it - pay the balance or add your side now.',
      jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                         'url', 'solidconnect://jobs/' || new.job_id || '/dispute')
    );
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.provider_id,
    'DISPUTE_OPENED',
    'A customer opened a dispute',
    'Add your side and any photos so Solid Connect can review it fairly.',
    jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                       'url', 'solidconnect://jobs/' || new.job_id || '/dispute')
  );
  return new;
end;
$$;

-- ── Balance reminders ───────────────────────────────────────────────────
-- Run hourly. Customers get at most two reminders (about 24h and 48h after
-- the provider finished); the provider is told once, at 72h, that they can
-- report the balance.
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
    select j.id, j.customer_id, j.provider_id, j.title, j.provider_completed_at, p.status as pay_status
    from public.jobs j
    join public.payments p on p.job_id = j.id
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
        case when r.pay_status = 'held' then 'Confirm your job' else 'Balance due' end,
        case when r.pay_status = 'held'
          then '"' || r.title || '" is finished. Confirm it so the provider can be paid.'
          else '"' || r.title || '" is finished. Pay the balance to Solid Connect and confirm the job.'
        end,
        jsonb_build_object('jobId', r.id)
      );
    end if;

    if r.provider_completed_at < now() - interval '72 hours'
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.provider_id and n.type = 'BALANCE_REPORT_AVAILABLE' and n.data ->> 'jobId' = r.id::text
       ) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.provider_id,
        'BALANCE_REPORT_AVAILABLE',
        'Still waiting on the customer',
        'You can now report the unpaid balance for "' || r.title || '" and Solid Connect will step in.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_balance_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'balance-reminders') then
    perform cron.schedule('balance-reminders', '15 * * * *', $sql$select public.send_balance_reminders();$sql$);
  end if;
end
$$;
