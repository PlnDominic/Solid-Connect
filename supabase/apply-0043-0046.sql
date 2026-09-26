-- Paste into Supabase Dashboard > SQL Editor > Run (0043 to 0046)
-- 0043 needs the pg_net extension (available on all Supabase projects).

-- ===== 0043_push_delivery.sql =====
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

-- ===== 0044_job_cancel_reschedule.sql =====
-- Job cancellation, no-show handling and rescheduling.
--
-- * cancel_job: either party can cancel before work starts; only the
--   provider can cancel once work is in progress (a customer who wants out
--   mid-job opens a dispute instead). No-show cancellations are only
--   allowed 30 minutes after the scheduled (or start) time, and only by
--   the party who was left waiting.
-- * propose_reschedule / respond_reschedule: either party proposes a new
--   time for a job that hasn't started; the other accepts or declines.
--   This is also how a first appointment time gets set (scheduled_for).
--
-- All money and state changes happen inside SECURITY DEFINER functions.

-- jobs: cancelled status + audit columns + scheduled time
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status = any (array[
    'accepted'::text,
    'in_progress'::text,
    'awaiting_completion_confirmation'::text,
    'completed'::text,
    'cancelled'::text
  ]));

alter table public.jobs
  add column if not exists scheduled_for timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text;

alter table public.job_events drop constraint if exists job_events_event_type_check;
alter table public.job_events
  add constraint job_events_event_type_check
  check (event_type = any (array[
    'CREATED'::text,
    'STARTED'::text,
    'FINISHED'::text,
    'STEP_ADVANCED'::text,
    'PROVIDER_COMPLETED'::text,
    'CUSTOMER_CONFIRMED'::text,
    'MESSAGE_HINT'::text,
    'CANCELLED'::text,
    'RESCHEDULE_PROPOSED'::text,
    'RESCHEDULE_ACCEPTED'::text,
    'RESCHEDULE_DECLINED'::text
  ]));

-- reschedule proposals
create table if not exists public.job_reschedules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  proposed_for timestamptz not null,
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists job_reschedules_job_idx on public.job_reschedules (job_id, created_at desc);

alter table public.job_reschedules enable row level security;

drop policy if exists "job parties and admins read reschedules" on public.job_reschedules;
create policy "job parties and admins read reschedules" on public.job_reschedules
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = job_reschedules.job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

-- cancel_job
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
  if p_reason <> 'no_show_customer' then
    update public.payments
    set status = 'refunded',
        refund_reason = 'Job cancelled (' || p_reason || ')',
        refund_amount = null
    where job_id = j.id and status = 'pending';
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

-- propose_reschedule
create or replace function public.propose_reschedule(
  p_job_id uuid,
  p_proposed_for timestamptz,
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
  v_other uuid;
  r public.job_reschedules%rowtype;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_uid <> j.customer_id and v_uid <> j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if j.status <> 'accepted' then raise exception 'JOB_ALREADY_STARTED'; end if;
  if p_proposed_for < now() + interval '15 minutes' then raise exception 'TIME_IN_PAST'; end if;
  if p_proposed_for > now() + interval '90 days' then raise exception 'TIME_TOO_FAR'; end if;

  v_other := case when v_uid = j.customer_id then j.provider_id else j.customer_id end;

  update public.job_reschedules
  set status = 'cancelled', responded_at = now()
  where job_id = j.id and status = 'pending';

  insert into public.job_reschedules (job_id, proposed_by, proposed_for, note)
  values (j.id, v_uid, p_proposed_for, coalesce(trim(p_note), ''))
  returning * into r;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, v_uid, 'RESCHEDULE_PROPOSED', j.step, j.step, to_char(p_proposed_for at time zone 'utc', 'YYYY-MM-DD HH24:MI') || ' UTC');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_other,
    'RESCHEDULE_PROPOSED',
    'New time proposed',
    'A new time was proposed for "' || j.title || '". Open the job to accept or decline.',
    jsonb_build_object('jobId', j.id, 'rescheduleId', r.id)
  );

  return to_jsonb(r);
end;
$$;

-- respond_reschedule
create or replace function public.respond_reschedule(
  p_reschedule_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.job_reschedules%rowtype;
  j public.jobs%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into r from public.job_reschedules where id = p_reschedule_id for update;
  if not found then raise exception 'RESCHEDULE_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'RESCHEDULE_NOT_PENDING'; end if;

  select * into j from public.jobs where id = r.job_id for update;
  if v_uid <> j.customer_id and v_uid <> j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_uid = r.proposed_by then raise exception 'CANNOT_ANSWER_OWN_PROPOSAL'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_ALREADY_STARTED'; end if;

  if p_accept and r.proposed_for < now() then raise exception 'TIME_IN_PAST'; end if;

  update public.job_reschedules
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = r.id
  returning * into r;

  if p_accept then
    update public.jobs set scheduled_for = r.proposed_for where id = j.id;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, v_uid, case when p_accept then 'RESCHEDULE_ACCEPTED' else 'RESCHEDULE_DECLINED' end, j.step, j.step, null);

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.proposed_by,
    case when p_accept then 'RESCHEDULE_ACCEPTED' else 'RESCHEDULE_DECLINED' end,
    case when p_accept then 'New time confirmed' else 'New time declined' end,
    case when p_accept then 'Your proposed time for "' || j.title || '" was accepted.'
         else 'Your proposed time for "' || j.title || '" was declined.' end,
    jsonb_build_object('jobId', j.id, 'rescheduleId', r.id)
  );

  return to_jsonb(r);
end;
$$;

revoke all on function public.cancel_job(uuid, text, text) from public, anon;
revoke all on function public.propose_reschedule(uuid, timestamptz, text) from public, anon;
revoke all on function public.respond_reschedule(uuid, boolean) from public, anon;
grant execute on function public.cancel_job(uuid, text, text) to authenticated, service_role;
grant execute on function public.propose_reschedule(uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.respond_reschedule(uuid, boolean) to authenticated, service_role;

-- Live updates so the other party sees a proposal the moment it lands.
do $$
begin
  begin
    alter publication supabase_realtime add table public.job_reschedules;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- ===== 0045_reports_and_blocks.sql =====
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

-- ===== 0046_safety_alerts.sql =====
-- Safety alerts: an "I need help" button on active jobs. The alert records
-- who raised it, which job it was on and the last known location, and shows
-- up at the top of the admin panel until an admin resolves it. Emergency
-- numbers are dialled from the phone directly; this is the extra step that
-- lets the Solid Connect team follow up.

create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  lat double precision,
  lng double precision,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_note text,
  resolved_by uuid references public.admins(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists safety_alerts_status_idx on public.safety_alerts (status, created_at desc);

alter table public.safety_alerts enable row level security;

drop policy if exists "people and admins read safety alerts" on public.safety_alerts;
create policy "people and admins read safety alerts" on public.safety_alerts
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "people raise their own safety alerts" on public.safety_alerts;
create policy "people raise their own safety alerts" on public.safety_alerts
  for insert with check (
    user_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and (
      job_id is null
      or exists (
        select 1 from public.jobs j
        where j.id = job_id and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
      )
    )
  );

-- A stuck button should not flood the queue: at most 5 alerts an hour.
create or replace function public.limit_safety_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.safety_alerts
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'ALERT_RATE_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists safety_alerts_rate_limit on public.safety_alerts;
create trigger safety_alerts_rate_limit
  before insert on public.safety_alerts
  for each row execute function public.limit_safety_alerts();

notify pgrst, 'reload schema';
