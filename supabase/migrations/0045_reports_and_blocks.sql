-- User reports and blocks.
--
-- * user_reports: anyone signed in can report another user (from a chat,
--   a provider profile or a job). Reports are reviewed by admins in the
--   admin panel; only the reporter and admins can read them.
-- * user_blocks: a person can block another user. A block stops chat
--   messages in both directions (enforced by a trigger, not just the UI).

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  context text not null default 'profile'
    check (context in ('profile', 'chat', 'job')),
  job_id uuid references public.jobs(id) on delete set null,
  thread_id uuid references public.chat_threads(id) on delete set null,
  reason text not null
    check (reason in ('harassment', 'scam_or_fraud', 'inappropriate_content', 'unsafe_behavior', 'fake_profile', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'actioned')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index if not exists user_reports_status_idx on public.user_reports (status, created_at desc);
create index if not exists user_reports_reported_idx on public.user_reports (reported_id);

alter table public.user_reports enable row level security;

drop policy if exists "reporters and admins read reports" on public.user_reports;
create policy "reporters and admins read reports" on public.user_reports
  for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "users file their own reports" on public.user_reports;
create policy "users file their own reports" on public.user_reports
  for insert with check (
    reporter_id = auth.uid()
    and reported_id <> auth.uid()
    and status = 'open'
    and reviewed_by is null
  );

-- Stop report spam: at most 20 reports a day per person.
create or replace function public.limit_user_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'REPORT_RATE_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists user_reports_rate_limit on public.user_reports;
create trigger user_reports_rate_limit
  before insert on public.user_reports
  for each row execute function public.limit_user_reports();

-- Blocks
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "blockers read their own blocks" on public.user_blocks;
create policy "blockers read their own blocks" on public.user_blocks
  for select using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists "users block others" on public.user_blocks;
create policy "users block others" on public.user_blocks
  for insert with check (blocker_id = auth.uid());

drop policy if exists "users unblock others" on public.user_blocks;
create policy "users unblock others" on public.user_blocks
  for delete using (blocker_id = auth.uid());

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated, service_role;

-- A block silences the conversation both ways.
create or replace function public.reject_blocked_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.chat_threads%rowtype;
begin
  select * into t from public.chat_threads where id = new.thread_id;
  if found and public.is_blocked_between(t.customer_id, t.provider_id) then
    raise exception 'BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_reject_blocked on public.chat_messages;
create trigger chat_messages_reject_blocked
  before insert on public.chat_messages
  for each row execute function public.reject_blocked_chat_message();
