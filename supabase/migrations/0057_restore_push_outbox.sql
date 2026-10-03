-- 0049 moved device pushes onto push_outbox (drained by the Nest
-- PushService), but 0054 later redefined send_push_for_notification to call
-- Expo directly again, which left the outbox empty. Put the queue back.
-- 0054's per-notification deep link (data.url) is honoured by the worker's
-- pushDeepLink, so nothing from 0054 is lost.

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_outbox (notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_for_notification();
