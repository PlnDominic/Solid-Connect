-- Push delivery. Every notification in the app is a row in
-- public.notifications (job RPCs, request cancellation, admin broadcast,
-- ...), so one AFTER INSERT trigger is the single place that turns those
-- rows into real device pushes through Expo's push service. It respects
-- the user's notification_prefs and can never block or fail the insert.

create extension if not exists pg_net with schema extensions;

create or replace function public.notification_pref_key(p_type text)
returns text
language sql
immutable
as $$
  select case
    when p_type ilike '%QUOTE%' then 'newQuotes'
    when p_type ilike '%MESSAGE%' or p_type ilike 'CHAT%' then 'messages'
    when p_type ilike '%BROADCAST%' or p_type ilike 'PROMO%' then 'promotions'
    else 'jobUpdates'
  end;
$$;

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_prefs jsonb;
  v_key text;
  v_enabled boolean;
  v_url text;
begin
  select push_token, notification_prefs into v_token, v_prefs
  from public.profiles where id = new.user_id;

  if v_token is null or v_token !~ '^Expo(nent)?PushToken\[' then
    return new;
  end if;

  v_key := public.notification_pref_key(new.type);
  -- Missing key = default: everything on except promotions.
  v_enabled := coalesce((v_prefs ->> v_key)::boolean, v_key <> 'promotions');
  if not v_enabled then
    return new;
  end if;

  v_url := case
    when new.data ? 'jobId' then 'solidconnect://jobs/' || (new.data ->> 'jobId')
    else 'solidconnect://notifications'
  end;

  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object(
        'to', v_token,
        'title', new.title,
        'body', new.body,
        'sound', 'default',
        'channelId', 'default',
        'data', coalesce(new.data, '{}'::jsonb) || jsonb_build_object('notificationId', new.id, 'type', new.type, 'url', v_url)
      )
    );
  exception when others then
    -- A push failure must never roll back the notification itself.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_for_notification();
