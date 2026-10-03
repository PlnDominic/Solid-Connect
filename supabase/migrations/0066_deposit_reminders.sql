-- Deposit reminders (follows 0065).
--
-- 1. When a provider accepts a direct request, the customer's notification
--    asks for the deposit (with the amount) instead of saying "waiting for
--    the provider to start" - nothing starts until the deposit is paid.
-- 2. The hourly reminder job also nudges customers whose booking deposit is
--    still unpaid: about 3 hours after booking, and once more at 24 hours.
--    Covers bookings from accepted quotes as well as direct requests.
--    send_balance_reminders keeps its name so the existing cron job
--    ('balance-reminders') picks this up with no rescheduling.

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
  v_deposit integer;
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

  insert into public.payments (job_id, amount, status)
  values (j.id, price, 'pending')
  returning deposit_amount into v_deposit;

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created — start work when ready');

  -- With deposits on (0065) nothing starts until the customer pays one, so
  -- say so - and how much - rather than "waiting for the provider".
  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    case when coalesce(v_deposit, 0) > 0
      then 'Provider accepted - pay your deposit'
      else 'Provider accepted your request'
    end,
    case when coalesce(v_deposit, 0) > 0
      then 'Your job is set at GHS ' || price::text || '. Pay a GHS ' || v_deposit::text
           || ' deposit to Solid Connect to secure the booking - the provider starts once it is in.'
      else 'Your job is set up at GHS ' || price::text || '. Waiting for the provider to start.'
    end,
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

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
  -- Deposit nudges: a booking whose deposit still isn't paid, about 3 and
  -- 24 hours after it was made. Nothing can start until it is.
  for r in
    select j.id, j.customer_id, j.title, j.created_at, p.deposit_amount
    from public.jobs j
    join public.payments p on p.job_id = j.id
    where j.status = 'accepted'
      and p.status = 'pending'
      and p.deposit_amount > 0
      and j.created_at < now() - interval '3 hours'
  loop
    select count(*) into v_sent from public.notifications n
    where n.user_id = r.customer_id and n.type = 'DEPOSIT_REMINDER' and n.data ->> 'jobId' = r.id::text;

    if v_sent = 0 or (v_sent = 1 and r.created_at < now() - interval '24 hours'
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.customer_id and n.type = 'DEPOSIT_REMINDER'
           and n.data ->> 'jobId' = r.id::text and n.created_at > now() - interval '20 hours'
       )) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'DEPOSIT_REMINDER',
        'Secure your booking',
        'Pay the GHS ' || r.deposit_amount || ' deposit for "' || r.title
          || '" to Solid Connect. The provider can''t start until it''s in.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;

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
