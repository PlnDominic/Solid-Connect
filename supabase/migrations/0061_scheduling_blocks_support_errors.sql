-- Four independent additions, each safe to re-run:
--   A. Request scheduling: when the customer wants the work done.
--   B. Blocking, enforced beyond chat: no direct requests, matches or
--      quotes between two people when either has blocked the other.
--   C. In-app support: tickets and a message thread with the support team.
--   D. Client error reports from the mobile app (crash reporting).

-- ── A. Request scheduling ────────────────────────────────────────────────
alter table public.service_requests
  add column if not exists preferred_time timestamptz,
  add column if not exists urgency text not null default 'flexible';

alter table public.service_requests drop constraint if exists service_requests_urgency_check;
alter table public.service_requests
  add constraint service_requests_urgency_check check (urgency in ('urgent', 'soon', 'flexible', 'scheduled'));

-- A job inherits the customer's requested time as its appointment, so it
-- shows on the job screen and anchors no-show timing (see 0044).
create or replace function public.job_inherit_request_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_for is null then
    select r.preferred_time into new.scheduled_for
    from public.service_requests r
    where r.id = new.request_id and r.preferred_time > now();
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_inherit_request_schedule on public.jobs;
create trigger jobs_inherit_request_schedule
  before insert on public.jobs
  for each row execute function public.job_inherit_request_schedule();

-- ── B. Blocking beyond chat ──────────────────────────────────────────────
-- Everyone this person has blocked or been blocked by, so lists can hide
-- them. Only ids come back; nothing says which side did the blocking.
create or replace function public.my_block_partners()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id from public.user_blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.user_blocks where blocked_id = auth.uid();
$$;

revoke all on function public.my_block_partners() from public, anon;
grant execute on function public.my_block_partners() to authenticated;

create or replace function public.reject_blocked_direct_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.preferred_provider_id is not null
     and public.is_blocked_between(new.customer_id, new.preferred_provider_id) then
    raise exception 'BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_reject_blocked on public.service_requests;
create trigger service_requests_reject_blocked
  before insert or update of preferred_provider_id on public.service_requests
  for each row execute function public.reject_blocked_direct_request();

-- Matching silently skips a provider who is blocked either way; returning
-- null drops just that one row, the rest of the batch still goes in.
create or replace function public.skip_blocked_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.service_requests where id = new.request_id;
  if v_customer is not null and public.is_blocked_between(v_customer, new.provider_id) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists request_opportunities_skip_blocked on public.request_opportunities;
create trigger request_opportunities_skip_blocked
  before insert on public.request_opportunities
  for each row execute function public.skip_blocked_opportunity();

create or replace function public.reject_blocked_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.service_requests where id = new.request_id;
  if v_customer is not null and public.is_blocked_between(v_customer, new.provider_id) then
    raise exception 'BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_reject_blocked on public.quotes;
create trigger quotes_reject_blocked
  before insert on public.quotes
  for each row execute function public.reject_blocked_quote();

-- ── C. In-app support ────────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  category text not null default 'other'
    check (category in ('account', 'payment', 'job', 'safety', 'bug', 'other')),
  job_id uuid references public.jobs(id) on delete set null,
  -- open: waiting on support; waiting_on_user: support replied; resolved.
  status text not null default 'open' check (status in ('open', 'waiting_on_user', 'resolved')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_message_at);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "users and admins read tickets" on public.support_tickets;
create policy "users and admins read tickets" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users open their own tickets" on public.support_tickets;
create policy "users open their own tickets" on public.support_tickets
  for insert with check (user_id = auth.uid() and status = 'open' and resolved_at is null);

drop policy if exists "ticket owners and admins read messages" on public.support_messages;
create policy "ticket owners and admins read messages" on public.support_messages
  for select using (
    public.is_admin()
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

-- Users post only as themselves, never as staff; staff replies come from
-- the admin panel with the service role.
drop policy if exists "ticket owners post messages" on public.support_messages;
create policy "ticket owners post messages" on public.support_messages
  for insert with check (
    from_staff = false
    and sender_id = auth.uid()
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

-- Keeps the ticket's status and ordering in step with its conversation,
-- and tells the user when support replies (which also sends a push, 0043).
create or replace function public.support_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.support_tickets%rowtype;
begin
  update public.support_tickets
  set last_message_at = new.created_at,
      status = case when new.from_staff then 'waiting_on_user' else 'open' end,
      resolved_at = case when new.from_staff then resolved_at else null end
  where id = new.ticket_id
  returning * into t;

  if new.from_staff and t.user_id is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      t.user_id,
      'SUPPORT_REPLY',
      'Support replied',
      left(new.body, 140),
      jsonb_build_object('ticketId', t.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists support_messages_after_insert on public.support_messages;
create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row execute function public.support_message_after_insert();

-- At most 10 new tickets a day per person.
create or replace function public.limit_support_tickets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.support_tickets
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'TICKET_RATE_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_rate_limit on public.support_tickets;
create trigger support_tickets_rate_limit
  before insert on public.support_tickets
  for each row execute function public.limit_support_tickets();

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;

-- ── D. Client error reports ──────────────────────────────────────────────
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  message text not null check (char_length(message) <= 1000),
  stack text check (char_length(stack) <= 8000),
  fatal boolean not null default false,
  platform text check (char_length(platform) <= 20),
  app_version text check (char_length(app_version) <= 40),
  screen text check (char_length(screen) <= 120),
  created_at timestamptz not null default now()
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

drop policy if exists "admins read client errors" on public.client_errors;
create policy "admins read client errors" on public.client_errors
  for select using (public.is_admin());

-- Signed-out crashes (e.g. during sign-up) matter too, so anon can report,
-- but only as nobody or as themselves.
drop policy if exists "apps report errors" on public.client_errors;
create policy "apps report errors" on public.client_errors
  for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

-- A crash loop shouldn't flood the table: 30 reports a minute overall per
-- user (or per anonymous caller bucket).
create or replace function public.limit_client_errors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.client_errors
      where user_id is not distinct from new.user_id and created_at > now() - interval '1 minute') >= 30 then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists client_errors_rate_limit on public.client_errors;
create trigger client_errors_rate_limit
  before insert on public.client_errors
  for each row execute function public.limit_client_errors();
