-- Phone notifications and job post expiry notices, run by the database.
--
-- Until now push_outbox (0049/0057) was only emptied, and sweep_job_posts()
-- (0084) only called, by the api/ server. Without that server nothing was
-- ever sent. pg_cron now does both. Do not also run the API's push sender.
-- Safe to run more than once.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

alter table public.push_outbox
  add column if not exists request_id bigint,
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists receipt_request_id bigint,
  add column if not exists receipt_requested_at timestamptz;

-- pg_net is asynchronous: a request leaves after this transaction commits and
-- its answer appears in net._http_response, so each run first reads the
-- answers to the last run, then sends what is waiting.
create or replace function public.drain_push_outbox()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_body jsonb;
  v_ticket jsonb;
  v_error text;
  v_key text;
  v_enabled boolean;
  v_url text;
  v_request bigint;
  v_ids uuid[];
  v_tickets jsonb;
begin
  -- 1. Answers to messages already handed to Expo.
  for r in
    select o.id, o.user_id, o.push_token, o.attempts, o.claimed_at,
           h.id as answered, h.status_code, h.content
    from public.push_outbox o
    left join net._http_response h on h.id = o.request_id
    where o.status = 'sending'
    for update of o skip locked
  loop
    if r.answered is null then
      -- It may have gone out, so it is not sent again.
      if r.claimed_at is null or r.claimed_at < now() - interval '10 minutes' then
        update public.push_outbox set status = 'failed', error = 'NO_RESPONSE' where id = r.id;
      end if;
    elsif r.status_code = 200 then
      begin
        v_ticket := r.content::jsonb -> 'data';
      exception when others then
        v_ticket := null;
      end;
      if jsonb_typeof(v_ticket) = 'array' then
        v_ticket := v_ticket -> 0;
      end if;
      if v_ticket ->> 'status' = 'ok' and v_ticket ->> 'id' is not null then
        update public.push_outbox
          set status = 'sent', ticket_id = v_ticket ->> 'id', sent_at = now(), error = null
          where id = r.id;
      else
        v_error := coalesce(v_ticket #>> '{details,error}', v_ticket ->> 'message', 'PUSH_REJECTED');
        update public.push_outbox set status = 'failed', error = v_error where id = r.id;
        if v_error = 'DeviceNotRegistered' then
          update public.profiles set push_token = null where id = r.user_id and push_token = r.push_token;
        end if;
      end if;
    elsif (r.status_code is null or r.status_code = 429 or r.status_code >= 500) and r.attempts < 3 then
      update public.push_outbox set status = 'pending', request_id = null where id = r.id;
    else
      update public.push_outbox
        set status = 'failed', error = 'EXPO_HTTP_' || coalesce(r.status_code::text, 'NONE')
        where id = r.id;
    end if;
  end loop;

  -- 2. A day-old notification is no longer news.
  update public.push_outbox set status = 'skipped', error = 'EXPIRED'
    where status = 'pending' and created_at < now() - interval '24 hours';

  -- 3. Send what is waiting.
  for r in
    select o.id, p.push_token, p.notification_prefs, n.id as notification_id, n.type, n.title, n.body,
           coalesce(n.data, '{}'::jsonb) as data
    from public.push_outbox o
    join public.notifications n on n.id = o.notification_id
    join public.profiles p on p.id = o.user_id
    where o.status = 'pending'
    order by o.created_at
    limit 200
    for update of o skip locked
  loop
    if coalesce(r.push_token, '') !~ '^Expo(nent)?PushToken\[.+\]$' then
      update public.push_outbox set status = 'skipped', error = 'NO_TOKEN' where id = r.id;
      continue;
    end if;

    -- A missing choice means on, except promotions.
    v_key := public.notification_pref_key(r.type);
    v_enabled := case
      when jsonb_typeof(r.notification_prefs -> v_key) = 'boolean' then (r.notification_prefs ->> v_key)::boolean
      else v_key <> 'promotions'
    end;
    if not v_enabled then
      update public.push_outbox set status = 'skipped', error = 'PREF_OFF' where id = r.id;
      continue;
    end if;

    v_url := case
      when r.data ->> 'url' like 'solidconnect://%' then r.data ->> 'url'
      when coalesce(r.data ->> 'jobId', '') <> '' then 'solidconnect://jobs/' || (r.data ->> 'jobId')
      else 'solidconnect://notifications'
    end;

    v_request := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object(
        'to', r.push_token,
        'title', r.title,
        'body', r.body,
        'sound', 'default',
        'channelId', 'default',
        'data', r.data || jsonb_build_object('notificationId', r.notification_id, 'type', r.type, 'url', v_url)
      ),
      timeout_milliseconds := 10000
    );
    update public.push_outbox
      set status = 'sending', request_id = v_request, claimed_at = now(),
          attempts = attempts + 1, push_token = r.push_token, error = null
      where id = r.id;
  end loop;

  -- 4. Answers to receipt checks. A receipt says whether Apple or Google took
  -- the message; errors such as bad push credentials only show up here.
  for r in
    select distinct o.receipt_request_id as request, h.id as answered, h.status_code, h.content,
           o.receipt_requested_at
    from public.push_outbox o
    left join net._http_response h on h.id = o.receipt_request_id
    where o.receipt_request_id is not null and o.receipt_checked_at is null
  loop
    v_body := null;
    if r.answered is not null and r.status_code = 200 then
      begin
        v_body := r.content::jsonb -> 'data';
      exception when others then
        v_body := null;
      end;
    elsif r.answered is null and r.receipt_requested_at > now() - interval '10 minutes' then
      continue;
    end if;

    if v_body is not null then
      update public.profiles p set push_token = null
        from public.push_outbox o
        where o.receipt_request_id = r.request and o.user_id = p.id and o.push_token = p.push_token
          and v_body -> o.ticket_id #>> '{details,error}' = 'DeviceNotRegistered';
      update public.push_outbox o
        set receipt_checked_at = now(),
            error = case
              when v_body -> o.ticket_id ->> 'status' = 'error'
                then coalesce(v_body -> o.ticket_id #>> '{details,error}', v_body -> o.ticket_id ->> 'message')
            end
        where o.receipt_request_id = r.request and v_body ? o.ticket_id;
    end if;
    -- Anything not answered is asked about again later.
    update public.push_outbox set receipt_request_id = null
      where receipt_request_id = r.request and receipt_checked_at is null;
  end loop;

  -- 5. Ask for receipts. Expo keeps them for about a day.
  select array_agg(t.id), jsonb_agg(t.ticket_id)
    into v_ids, v_tickets
  from (
    select id, ticket_id from public.push_outbox
    where status = 'sent' and ticket_id is not null
      and receipt_checked_at is null and receipt_request_id is null
      and sent_at < now() - interval '15 minutes' and sent_at > now() - interval '24 hours'
      and (receipt_requested_at is null or receipt_requested_at < now() - interval '15 minutes')
    order by sent_at
    limit 300
  ) t;
  if v_ids is not null then
    v_request := net.http_post(
      url := 'https://exp.host/--/api/v2/push/getReceipts',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object('ids', v_tickets),
      timeout_milliseconds := 10000
    );
    update public.push_outbox set receipt_request_id = v_request, receipt_requested_at = now()
      where id = any(v_ids);
  end if;
end;
$$;

revoke all on function public.drain_push_outbox() from public, anon, authenticated;

-- Do not send the backlog that built up while nothing was sending.
update public.push_outbox set status = 'skipped', error = 'EXPIRED'
  where status = 'pending' and created_at < now() - interval '1 hour';

do $$
begin
  -- Lets the expiry flags be written past the owner-facing guard (0084).
  perform set_config('app.job_post_counter', 'on', true);
  update public.job_posts set expiry_notified_at = now()
    where status = 'open' and expires_at < now() - interval '2 days' and expiry_notified_at is null;
  perform set_config('app.job_post_counter', 'off', true);
end $$;

-- Scheduling with the same name again replaces the job.
select cron.schedule('send-push-notifications', '30 seconds', 'select public.drain_push_outbox()');
select cron.schedule('sweep-job-posts', '*/5 * * * *', 'select public.sweep_job_posts()');
-- A run every 30 seconds would otherwise fill the run history.
select cron.schedule(
  'trim-cron-history', '40 3 * * *',
  $sql$delete from cron.job_run_details where end_time < now() - interval '3 days'$sql$
);
