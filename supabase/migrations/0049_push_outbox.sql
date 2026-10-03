-- Phase I: queue device pushes instead of calling Expo from the insert
-- trigger. Nest drains push_outbox, which is the background worker for
-- FCM (Android) and APNs (iOS) through Expo's push service.

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_token text,
  ticket_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  receipt_checked_at timestamptz
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (created_at)
  where status = 'pending';

alter table public.push_outbox enable row level security;

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

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
