-- Solid Connect: migrations 0082 to 0088, in one paste.
--
-- Paste into Supabase Dashboard > SQL Editor > New query, then Run. It runs as one
-- transaction: if anything fails, nothing is changed. It is safe to run again.
--
-- What it does:
--   0082  job posts (customers post jobs, providers show interest)
--   0083  post expiry, alerts to providers, deep links, reporting a job post
--   0084  blocks, posting limit, closing notices, reopen when a hire falls through
--   0085  no platform payments (job functions stop creating or holding payments)
--   0086  real ratings only (clears made-up ratings, new providers start empty)
--   0087  availability from the app (no API needed)
--   0088  hardening: review forgery, self-dealing, subscription gate (off), limits, leaks
--
-- Needs 0001 to 0081 already applied (the check below tells you if not).
-- Not included: 0089 (private photos). Run supabase/apply-0089-after-new-builds.sql later.
-- ===== Pre-flight check: stops with a clear message if an earlier migration is missing =====
do $preflight$
declare
  missing text[] := '{}';
  item text;
begin
  foreach item in array array[
    'public.profiles', 'public.service_requests', 'public.quotes', 'public.jobs', 'public.reviews',
    'public.notifications', 'public.chat_threads', 'public.request_opportunities',
    'public.provider_availability',        -- 0012
    'public.user_blocks',                  -- 0045
    'public.user_reports',                 -- 0045
    'public.referrals',                    -- 0060
    'public.customer_reviews',             -- 0062
    'public.provider_subscriptions',       -- 0081
    'public.platform_config'
  ] loop
    if to_regclass(item) is null then missing := array_append(missing, item); end if;
  end loop;

  foreach item in array array[
    'public.is_admin()', 'public.has_job_post_interest(uuid)'
  ] loop
    -- has_job_post_interest is created by 0082 itself, so only is_admin must already exist
    if item = 'public.is_admin()' and to_regprocedure(item) is null then missing := array_append(missing, item); end if;
  end loop;

  if to_regprocedure('public.provider_subscription_expiry(uuid)') is null then
    missing := array_append(missing, 'public.provider_subscription_expiry(uuid) (0081)'::text);
  end if;
  if to_regprocedure('public.provider_trial_used(uuid)') is null then
    missing := array_append(missing, 'public.provider_trial_used(uuid) (0081)'::text);
  end if;
  if to_regprocedure('public.sync_provider_opportunities(uuid)') is null then
    missing := array_append(missing, 'public.sync_provider_opportunities(uuid) (0013)'::text);
  end if;
  if to_regprocedure('public.can_view_request(uuid)') is null then
    missing := array_append(missing, 'public.can_view_request(uuid) (0080)'::text);
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Stopped, nothing changed. Run the earlier migrations first (see supabase/apply-pending.sql and supabase/apply-0077-0080.sql). Missing: %', array_to_string(missing, ', ');
  end if;
end
$preflight$;


-- ===== 0082_job_posts.sql =====
-- Job posts: a public job board.
--
-- A service request (service_requests) is matched to a handful of nearby
-- providers. A job post is the open alternative: the customer describes the
-- job once and it shows on the feed of every provider, whatever their
-- service area. Providers who want it express interest (with a short note
-- and an optional price); the customer reviews who is interested and hires
-- one of them through the usual direct-request flow.
--
-- Who can read what:
--   job_posts           - anyone signed in can read open posts; the
--                         customer always reads their own; providers who
--                         expressed interest keep reading it after it closes;
--                         admins
--   job_post_interests  - the provider who wrote it; the post's customer;
--                         admins
-- Nothing is readable while signed out.

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  category_id text references public.categories(id),
  category_label text not null,
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  budget_min numeric(10, 2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(10, 2) check (budget_max is null or budget_max >= 0),
  budget_type text not null default 'range' check (budget_type in ('fixed', 'range', 'negotiable')),
  location_label text not null,
  start_preference text not null default 'flexible'
    check (start_preference in ('asap', 'this_week', 'flexible', 'date')),
  start_date date,
  photos text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed', 'hired')),
  hired_provider_id uuid references public.profiles(id) on delete set null,
  interest_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index if not exists job_posts_status_created_idx
  on public.job_posts (status, created_at desc);
create index if not exists job_posts_customer_idx
  on public.job_posts (customer_id, created_at desc);
create index if not exists job_posts_category_idx
  on public.job_posts (category_id);

create table if not exists public.job_post_interests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.job_posts(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 600),
  proposed_price numeric(10, 2) check (proposed_price is null or proposed_price > 0),
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'declined', 'hired')),
  created_at timestamptz not null default now(),
  unique (post_id, provider_id)
);

create index if not exists job_post_interests_post_idx
  on public.job_post_interests (post_id, created_at desc);
create index if not exists job_post_interests_provider_idx
  on public.job_post_interests (provider_id, created_at desc);

-- Lookups used by the policies below. SECURITY DEFINER so a policy on one
-- table can consult the other without recursing through its policies.
create or replace function public.is_job_post_owner(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from public.job_posts p where p.id = p_post_id and p.customer_id = auth.uid());
$$;

create or replace function public.has_job_post_interest(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.job_post_interests i
      where i.post_id = p_post_id and i.provider_id = auth.uid()
    );
$$;

create or replace function public.is_open_job_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.job_posts p where p.id = p_post_id and p.status = 'open');
$$;

revoke all on function public.is_job_post_owner(uuid) from public, anon;
revoke all on function public.has_job_post_interest(uuid) from public, anon;
revoke all on function public.is_open_job_post(uuid) from public, anon;
grant execute on function public.is_job_post_owner(uuid) to authenticated, service_role;
grant execute on function public.has_job_post_interest(uuid) to authenticated, service_role;
grant execute on function public.is_open_job_post(uuid) to authenticated, service_role;

alter table public.job_posts enable row level security;
alter table public.job_post_interests enable row level security;

revoke all on public.job_posts from anon, authenticated;
revoke all on public.job_post_interests from anon, authenticated;
grant select, insert, update, delete on public.job_posts to authenticated;
grant select, insert, update, delete on public.job_post_interests to authenticated;

-- job_posts ---------------------------------------------------------------

drop policy if exists "read open or own job posts" on public.job_posts;
create policy "read open or own job posts" on public.job_posts
  for select to authenticated
  using (
    status = 'open'
    or customer_id = auth.uid()
    or public.has_job_post_interest(id)
    or public.is_admin()
  );

drop policy if exists "customers create their own job posts" on public.job_posts;
create policy "customers create their own job posts" on public.job_posts
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'open'
    and interest_count = 0
    and hired_provider_id is null
  );

drop policy if exists "customers update their own job posts" on public.job_posts;
create policy "customers update their own job posts" on public.job_posts
  for update to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

drop policy if exists "customers delete their own job posts" on public.job_posts;
create policy "customers delete their own job posts" on public.job_posts
  for delete to authenticated
  using (customer_id = auth.uid());

-- interest_count is owned by the trigger below; stop the owner from
-- writing it (or moving the post to another customer) on update.
create or replace function public.job_posts_guard_update()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.job_post_counter', true) = 'on' then
    return new;
  end if;
  new.customer_id := old.customer_id;
  new.interest_count := old.interest_count;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_posts_guard_update on public.job_posts;
create trigger job_posts_guard_update
  before update on public.job_posts
  for each row execute function public.job_posts_guard_update();

-- job_post_interests ------------------------------------------------------

drop policy if exists "interest parties read interests" on public.job_post_interests;
create policy "interest parties read interests" on public.job_post_interests
  for select to authenticated
  using (
    provider_id = auth.uid()
    or public.is_job_post_owner(post_id)
    or public.is_admin()
  );

drop policy if exists "providers express interest in open posts" on public.job_post_interests;
create policy "providers express interest in open posts" on public.job_post_interests
  for insert to authenticated
  with check (
    provider_id = auth.uid()
    and status = 'pending'
    and public.is_open_job_post(post_id)
    and not public.is_job_post_owner(post_id)
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'provider')
  );

-- The provider edits their note/price; the customer moves the status.
drop policy if exists "interest parties update interests" on public.job_post_interests;
create policy "interest parties update interests" on public.job_post_interests
  for update to authenticated
  using (provider_id = auth.uid() or public.is_job_post_owner(post_id))
  with check (provider_id = auth.uid() or public.is_job_post_owner(post_id));

drop policy if exists "providers withdraw their interest" on public.job_post_interests;
create policy "providers withdraw their interest" on public.job_post_interests
  for delete to authenticated
  using (provider_id = auth.uid());

create or replace function public.job_post_interests_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.post_id := old.post_id;
  new.provider_id := old.provider_id;
  new.created_at := old.created_at;
  if auth.uid() = old.provider_id and not public.is_job_post_owner(old.post_id) then
    -- Providers can only change their own note and price.
    new.status := old.status;
  elsif public.is_job_post_owner(old.post_id) then
    -- Customers can only change the status.
    new.message := old.message;
    new.proposed_price := old.proposed_price;
  end if;
  return new;
end;
$$;

drop trigger if exists job_post_interests_guard_update on public.job_post_interests;
create trigger job_post_interests_guard_update
  before update on public.job_post_interests
  for each row execute function public.job_post_interests_guard_update();

-- Keep job_posts.interest_count in step and tell the customer.
create or replace function public.job_post_interests_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.job_posts;
  v_provider_name text;
begin
  perform set_config('app.job_post_counter', 'on', true);
  if tg_op = 'INSERT' then
    update public.job_posts set interest_count = interest_count + 1 where id = new.post_id
      returning * into v_post;
    select full_name into v_provider_name from public.profiles where id = new.provider_id;
    if v_post.id is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_post.customer_id,
        'job_post_interest',
        coalesce(v_provider_name, 'A provider') || ' is interested in your job',
        v_post.title,
        jsonb_build_object('postId', v_post.id, 'providerId', new.provider_id)
      );
    end if;
  elsif tg_op = 'DELETE' then
    update public.job_posts set interest_count = greatest(interest_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('app.job_post_counter', 'off', true);
  return null;
end;
$$;

drop trigger if exists job_post_interests_after_change on public.job_post_interests;
create trigger job_post_interests_after_change
  after insert or delete on public.job_post_interests
  for each row execute function public.job_post_interests_after_change();

-- Realtime so a provider's feed and the customer's post update live.
do $$
begin
  begin
    alter publication supabase_realtime add table public.job_posts;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.job_post_interests;
  exception when duplicate_object or undefined_object then null;
  end;
end
$$;

-- ===== 0083_job_post_expiry_alerts_reports.sql =====
-- Job posts, part 2 (builds on 0082):
--   * posts expire (14 days by default, 31 days at most) so the board stays fresh
--   * providers in the post's category are notified (and pushed) about new posts
--   * notifications carry a deep link (data.url) so a tap opens the post
--   * a job post can be reported (shows up in the admin Reports queue)

-- Expiry ---------------------------------------------------------------------

alter table public.job_posts
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists job_posts_open_expiry_idx
  on public.job_posts (status, expires_at);

-- "Open" now means open and not expired.
create or replace function public.is_open_job_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.job_posts p
    where p.id = p_post_id and p.status = 'open' and p.expires_at > now()
  );
$$;

drop policy if exists "read open or own job posts" on public.job_posts;
create policy "read open or own job posts" on public.job_posts
  for select to authenticated
  using (
    (status = 'open' and expires_at > now())
    or customer_id = auth.uid()
    or public.has_job_post_interest(id)
    or public.is_admin()
  );

drop policy if exists "customers create their own job posts" on public.job_posts;
create policy "customers create their own job posts" on public.job_posts
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'open'
    and interest_count = 0
    and hired_provider_id is null
    and expires_at <= now() + interval '31 days'
  );

-- Customers can repost (push expires_at out) but never past 31 days.
create or replace function public.job_posts_guard_update()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.job_post_counter', true) = 'on' then
    return new;
  end if;
  new.customer_id := old.customer_id;
  new.interest_count := old.interest_count;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.expires_at := least(new.expires_at, now() + interval '31 days');
  return new;
end;
$$;

-- Tell providers about new posts -----------------------------------------------

create or replace function public.job_posts_notify_providers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select
    p.id,
    'job_post_new',
    'New job: ' || new.title,
    new.category_label || ' · ' || new.location_label,
    jsonb_build_object('postId', new.id, 'url', 'solidconnect://job-board/' || new.id)
  from public.profiles p
  where p.role = 'provider'
    and p.id <> new.customer_id
    and p.suspended_at is null
    and not public.is_blocked_between(p.id, new.customer_id)
    and (
      new.category_id is null
      or exists (
        select 1 from public.provider_categories pc
        where pc.provider_id = p.id and pc.category_id = new.category_id
      )
      or coalesce(p.provider_category, '') ilike '%' || new.category_label || '%'
    )
  limit 500;
  return null;
end;
$$;

drop trigger if exists job_posts_notify_providers on public.job_posts;
create trigger job_posts_notify_providers
  after insert on public.job_posts
  for each row execute function public.job_posts_notify_providers();

-- Same notification as 0082, now with a deep link.
create or replace function public.job_post_interests_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.job_posts;
  v_provider_name text;
begin
  perform set_config('app.job_post_counter', 'on', true);
  if tg_op = 'INSERT' then
    update public.job_posts set interest_count = interest_count + 1 where id = new.post_id
      returning * into v_post;
    select full_name into v_provider_name from public.profiles where id = new.provider_id;
    if v_post.id is not null then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_post.customer_id,
        'job_post_interest',
        coalesce(v_provider_name, 'A provider') || ' is interested in your job',
        v_post.title,
        jsonb_build_object(
          'postId', v_post.id,
          'providerId', new.provider_id,
          'url', 'solidconnect://job-posts/' || v_post.id
        )
      );
    end if;
  elsif tg_op = 'DELETE' then
    update public.job_posts set interest_count = greatest(interest_count - 1, 0) where id = old.post_id;
  end if;
  perform set_config('app.job_post_counter', 'off', true);
  return null;
end;
$$;

-- Reporting a job post -----------------------------------------------------------

alter table public.user_reports
  add column if not exists job_post_id uuid references public.job_posts(id) on delete set null;

alter table public.user_reports drop constraint if exists user_reports_context_check;
alter table public.user_reports add constraint user_reports_context_check
  check (context in ('profile', 'chat', 'job', 'job_post'));

-- ===== 0084_job_post_blocks_limits_notices.sql =====
-- Job posts, part 3 (builds on 0082 and 0083):
--   * blocks are honoured: a blocked provider can't see a customer's posts or
--     show interest in them
--   * posting is rate limited (5 a day per customer)
--   * providers who showed interest are told when a post is filled, closed or
--     expires; customers are warned a day before a post expires
--   * if the provider a customer hired declines (or the customer cancels) the
--     direct request, the post reopens

-- Blocks -----------------------------------------------------------------------

create or replace function public.job_post_blocked_for_me(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.job_posts p
    where p.id = p_post_id and public.is_blocked_between(auth.uid(), p.customer_id)
  );
$$;

revoke all on function public.job_post_blocked_for_me(uuid) from public, anon;
grant execute on function public.job_post_blocked_for_me(uuid) to authenticated, service_role;

drop policy if exists "read open or own job posts" on public.job_posts;
create policy "read open or own job posts" on public.job_posts
  for select to authenticated
  using (
    (status = 'open' and expires_at > now() and not public.is_blocked_between(auth.uid(), customer_id))
    or customer_id = auth.uid()
    or public.has_job_post_interest(id)
    or public.is_admin()
  );

drop policy if exists "providers express interest in open posts" on public.job_post_interests;
create policy "providers express interest in open posts" on public.job_post_interests
  for insert to authenticated
  with check (
    provider_id = auth.uid()
    and status = 'pending'
    and public.is_open_job_post(post_id)
    and not public.is_job_post_owner(post_id)
    and not public.job_post_blocked_for_me(post_id)
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'provider')
  );

-- Rate limit -------------------------------------------------------------------

create or replace function public.limit_job_posts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.job_posts
      where customer_id = new.customer_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'JOB_POST_RATE_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists job_posts_rate_limit on public.job_posts;
create trigger job_posts_rate_limit
  before insert on public.job_posts
  for each row execute function public.limit_job_posts();

-- New columns ------------------------------------------------------------------

alter table public.job_posts
  add column if not exists hire_request_id uuid references public.service_requests(id) on delete set null,
  add column if not exists expiry_warned_at timestamptz,
  add column if not exists expiry_notified_at timestamptz;

-- A repost starts a fresh lifetime, so the expiry notices can fire again.
create or replace function public.job_posts_guard_update()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.job_post_counter', true) = 'on' then
    return new;
  end if;
  new.customer_id := old.customer_id;
  new.interest_count := old.interest_count;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.expires_at := least(new.expires_at, now() + interval '31 days');
  new.expiry_warned_at := old.expiry_warned_at;
  new.expiry_notified_at := old.expiry_notified_at;
  if new.expires_at > old.expires_at then
    new.expiry_warned_at := null;
    new.expiry_notified_at := null;
  end if;
  return new;
end;
$$;

-- Tell interested providers when a post is filled or closed ---------------------

create or replace function public.job_posts_notify_closure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select
    i.provider_id,
    case when new.status = 'hired' then 'job_post_filled' else 'job_post_closed' end,
    case when new.status = 'hired' then 'Job filled: ' else 'Job closed: ' end || new.title,
    case when new.status = 'hired'
      then 'The customer chose another provider for this job.'
      else 'The customer is no longer taking interest in this job.' end,
    jsonb_build_object('postId', new.id, 'url', 'solidconnect://job-board/' || new.id)
  from public.job_post_interests i
  where i.post_id = new.id
    and i.status in ('pending', 'shortlisted')
    and i.provider_id is distinct from new.hired_provider_id;
  return null;
end;
$$;

drop trigger if exists job_posts_notify_closure on public.job_posts;
create trigger job_posts_notify_closure
  after update of status on public.job_posts
  for each row
  when (old.status = 'open' and new.status in ('hired', 'closed'))
  execute function public.job_posts_notify_closure();

-- Reopen a post when the hire falls through -------------------------------------

create or replace function public.reopen_job_post_on_declined_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.job_posts;
  v_name text;
begin
  if new.status not in ('rejected', 'cancelled') or old.status is not distinct from new.status then
    return null;
  end if;

  select * into v_post from public.job_posts where hire_request_id = new.id and status = 'hired';
  if v_post.id is null then
    return null;
  end if;

  perform set_config('app.job_post_counter', 'on', true);

  update public.job_post_interests
    set status = case when new.status = 'rejected' then 'declined' else 'pending' end
    where post_id = v_post.id and provider_id = v_post.hired_provider_id;

  update public.job_posts
    set status = 'open',
        hired_provider_id = null,
        hire_request_id = null,
        expires_at = now() + interval '14 days',
        expiry_warned_at = null,
        expiry_notified_at = null
    where id = v_post.id;

  perform set_config('app.job_post_counter', 'off', true);

  -- Only the provider declining is news to the customer; a cancel was their own act.
  if new.status = 'rejected' then
    select full_name into v_name from public.profiles where id = v_post.hired_provider_id;
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_post.customer_id,
      'job_post_reopened',
      'Your job is open again',
      coalesce(v_name, 'The provider') || ' declined, so "' || v_post.title || '" is back on the board.',
      jsonb_build_object('postId', v_post.id, 'url', 'solidconnect://job-posts/' || v_post.id)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists reopen_job_post_on_declined_request on public.service_requests;
create trigger reopen_job_post_on_declined_request
  after update of status on public.service_requests
  for each row execute function public.reopen_job_post_on_declined_request();

-- Expiry sweep (called every few minutes by the Nest API) --------------------------

create or replace function public.sweep_job_posts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- These updates set the expiry flags, which the owner-facing guard trigger
  -- would otherwise put back.
  perform set_config('app.job_post_counter', 'on', true);

  -- Warn customers a day before.
  with due as (
    update public.job_posts
      set expiry_warned_at = now()
      where status = 'open'
        and expires_at > now()
        and expires_at <= now() + interval '24 hours'
        and expiry_warned_at is null
      returning id, customer_id, title
  )
  insert into public.notifications (user_id, type, title, body, data)
  select
    customer_id,
    'job_post_expiring',
    'Your job post expires soon',
    '"' || title || '" stops taking interest within a day. Repost it to keep it live.',
    jsonb_build_object('postId', id, 'url', 'solidconnect://job-posts/' || id)
  from due;

  -- Tell the customer and everyone interested once a post has expired.
  with gone as (
    update public.job_posts
      set expiry_notified_at = now()
      where status = 'open'
        and expires_at <= now()
        and expiry_notified_at is null
      returning id, customer_id, title
  ),
  to_customer as (
    insert into public.notifications (user_id, type, title, body, data)
    select
      customer_id,
      'job_post_expired',
      'Your job post expired',
      '"' || title || '" is no longer on the board. Repost it to get more interest.',
      jsonb_build_object('postId', id, 'url', 'solidconnect://job-posts/' || id)
    from gone
    returning 1
  )
  insert into public.notifications (user_id, type, title, body, data)
  select
    i.provider_id,
    'job_post_expired',
    'Job expired: ' || gone.title,
    'This job is no longer taking interest.',
    jsonb_build_object('postId', gone.id, 'url', 'solidconnect://job-board/' || gone.id)
  from gone
  join public.job_post_interests i on i.post_id = gone.id and i.status in ('pending', 'shortlisted');

  perform set_config('app.job_post_counter', 'off', true);
end;
$$;

revoke execute on function public.sweep_job_posts() from public, anon, authenticated;
grant execute on function public.sweep_job_posts() to service_role;

-- ===== 0085_no_platform_payments.sql =====
-- Solid Connect no longer collects payment on behalf of providers.
--
-- Customers and providers settle directly (cash or Mobile Money). The
-- platform takes no deposit, holds no balance, charges no commission and
-- makes no payouts. This migration stops the job lifecycle from creating,
-- requiring, releasing or refunding anything in public.payments.
--
-- Nothing is dropped: payments, provider_payouts, deposit settings and every
-- existing row stay in place as an archive (accounting, past disputes). The
-- provider subscription (0081) is unaffected - that is Solid Connect charging
-- providers for its own service, not collecting on their behalf.

-- No deposit gate, deposit amounts or dispute hold on a payment ----------------

drop trigger if exists jobs_require_deposit on public.jobs;
drop trigger if exists payments_set_deposit on public.payments;
drop trigger if exists payments_block_release_during_dispute on public.payments;

-- Accepting a quote or a direct request: a job, without a payment row ----------

create or replace function public.accept_quote(
  p_quote_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
  j public.jobs%rowtype;
  title text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;

  select * into r from public.service_requests where id = q.request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.customer_id <> p_customer_id then raise exception 'NOT_REQUEST_OWNER'; end if;
  if r.status not in ('matching', 'quoted', 'open', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  if exists (select 1 from public.jobs j2 where j2.quote_id = q.id) then
    select * into j from public.jobs where quote_id = q.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
  end if;

  update public.quotes set status = 'accepted', updated_at = now() where id = q.id;
  update public.quotes
    set status = 'declined', updated_at = now()
    where request_id = r.id and id <> q.id and status = 'sent';
  update public.service_requests set status = 'accepted' where id = r.id;

  update public.request_opportunities
    set status = 'QUOTED'
    where request_id = r.id and provider_id = q.provider_id;

  title := trim(split_part(r.category_label, '·', 2));
  if title = '' then title := r.category_label; end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, q.provider_id, title, q.price, r.location_label, 1, 'accepted'
  )
  returning * into j;

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CREATED', 0, 1, 'Job created - waiting for provider to start');

  select * into q from public.quotes where id = p_quote_id;
  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

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

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created - start work when ready');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '. Agree how you will pay the provider directly. Waiting for them to start.',
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

-- Confirming completion: no payment to release ------------------------------------

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
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    return jsonb_build_object('job', to_jsonb(j));
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

  -- An open dispute has to be settled first.
  if exists (select 1 from public.disputes d where d.job_id = j.id and d.status = 'open') then
    raise exception 'JOB_DISPUTED' using errcode = '55000';
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

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5, 'Customer confirmed completion');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    'The customer confirmed the job is done.',
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j));
end;
$$;

-- Cancelling: nothing to refund or forfeit ----------------------------------------

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

-- "Unpaid balance" reports and payment reminders go away ----------------------------

drop function if exists public.report_unpaid_balance(uuid, text);

-- The hourly job keeps its name (the cron entry calls it) but now only nudges
-- a customer to confirm a finished job. No deposit or balance reminders.
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
    select j.id, j.customer_id, j.title, j.provider_completed_at
    from public.jobs j
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
        'Confirm your job',
        '"' || r.title || '" is finished. Confirm it once you are happy with the work.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;
end;
$$;

-- Chat no longer claims "all payments go through Solid Connect" ---------------------
-- 0071/0072 strip bank and mobile money details from chat messages and leave
-- a placeholder saying every payment goes through Solid Connect. Payment is
-- now direct, so only that placeholder text changes (the rules are untouched).
do $$
declare
  def text;
begin
  if to_regprocedure('public.strip_contact_details_from_message()') is not null then
    def := pg_get_functiondef('public.strip_contact_details_from_message()'::regprocedure);
    if position('Account details removed - all payments go through Solid Connect' in def) > 0 then
      execute replace(def, 'Account details removed - all payments go through Solid Connect', 'Account details removed');
    end if;
  end if;
end
$$;

-- ===== 0086_real_ratings.sql =====
-- Ratings come only from real reviews.
--
-- profiles.provider_rating defaulted to 4.8, so every provider with no reviews
-- looked 4.8-star rated, and providers created from demo data carried
-- made-up ratings and job counts. A rating now only exists once someone has
-- actually reviewed the provider:
--   * new providers start at 0 with 0 reviews (the app shows "New")
--   * existing providers are recomputed from their visible reviews
--
-- Run supabase/cleanup/02-remove-seed-data.sql first if demo accounts and their
-- reviews are still in the database; this migration then recomputes from what
-- is left. Hidden (moderated) reviews do not count, same as the admin tooling.
-- The apply_review() trigger already keeps a running average from here on.

alter table public.profiles alter column provider_rating set default 0;

update public.profiles p
set
  provider_rating = coalesce((
    select round(avg(r.rating)::numeric, 1)
    from public.reviews r
    where r.provider_id = p.id and r.hidden_at is null
  ), 0),
  provider_jobs_count = (
    select count(*)::int
    from public.reviews r
    where r.provider_id = p.id and r.hidden_at is null
  )
where p.role = 'provider';

-- ===== 0087_availability_rpcs.sql =====
-- Manage provider availability straight from the app (no Nest API needed).
--
-- Until now the Availability screen only worked when the API was deployed,
-- because profiles.availability_mode is locked against direct writes (0078)
-- and only the API's service role could change it. These two functions let a
-- signed-in provider change their own availability, and nothing else:
--
--   set_my_availability_mode(mode)      - AVAILABLE_NOW / SCHEDULE / UNAVAILABLE / PAUSED
--   replace_my_weekly_availability(...) - their weekly hours; switches them to SCHEDULE
--
-- They mirror the API's setAvailabilityMode / replaceWeeklyAvailability:
-- becoming eligible again (AVAILABLE_NOW or SCHEDULE) also re-runs matching
-- for requests already open (sync_provider_opportunities, 0013).
-- Requires migration 0012 (the provider_availability table and the
-- availability_mode column).

create or replace function public.set_my_availability_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode not in ('AVAILABLE_NOW', 'UNAVAILABLE', 'SCHEDULE', 'PAUSED') then
    raise exception 'INVALID_MODE';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'provider') then
    raise exception 'NOT_A_PROVIDER' using errcode = '42501';
  end if;

  update public.profiles set availability_mode = p_mode where id = v_uid;

  -- Only worth re-matching when the provider just became eligible again.
  if p_mode in ('AVAILABLE_NOW', 'SCHEDULE') then
    perform public.sync_provider_opportunities(v_uid);
  end if;

  return p_mode;
end;
$$;

-- p_slots: [{ "dayOfWeek": 0-6, "startTime": "08:00", "endTime": "18:00" }, ...]
create or replace function public.replace_my_weekly_availability(p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slot jsonb;
  v_start time;
  v_end time;
  v_day int;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'provider') then
    raise exception 'NOT_A_PROVIDER' using errcode = '42501';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'INVALID_SLOTS';
  end if;
  if jsonb_array_length(p_slots) > 28 then
    raise exception 'TOO_MANY_SLOTS';
  end if;

  -- Validate everything before touching the existing hours.
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_day := (v_slot ->> 'dayOfWeek')::int;
    v_start := (v_slot ->> 'startTime')::time;
    v_end := (v_slot ->> 'endTime')::time;
    if v_day is null or v_day not between 0 and 6 or v_start is null or v_end is null or v_end <= v_start then
      raise exception 'INVALID_SLOTS';
    end if;
  end loop;

  delete from public.provider_availability where provider_id = v_uid;

  insert into public.provider_availability (provider_id, day_of_week, start_time, end_time)
  select
    v_uid,
    (s ->> 'dayOfWeek')::smallint,
    (s ->> 'startTime')::time,
    (s ->> 'endTime')::time
  from jsonb_array_elements(p_slots) s
  on conflict (provider_id, day_of_week, start_time, end_time) do nothing;

  -- Setting hours puts the provider on their schedule.
  perform public.set_my_availability_mode('SCHEDULE');
end;
$$;

revoke all on function public.set_my_availability_mode(text) from public, anon;
revoke all on function public.replace_my_weekly_availability(jsonb) from public, anon;
grant execute on function public.set_my_availability_mode(text) to authenticated;
grant execute on function public.replace_my_weekly_availability(jsonb) to authenticated;

-- ===== 0088_hardening.sql =====
-- Hardening: review forgery, self-dealing, subscription gate, upload limits,
-- small information leaks. Written from docs/private/platform-audit-2026-11-10.md.
--
-- Safe to apply with the app builds that are out today: every rule here only
-- refuses things the app never does.
--
--   A. Reviews must be about a real, completed job between the two people
--   B. A person can never be both sides of a job; quotes need a real provider
--      and a request that is not their own
--   C. Referral rewards cannot be farmed with a friend account you also work
--   D. The provider subscription is enforced in the database (off until you
--      switch it on, so providers are never locked out before they can pay)
--   E. Size and type limits on every storage bucket
--   F. Phone and email "is it registered?" checks no longer work signed out
--   G. Small leaks: unread counts, block status, request location
--   H. Customer ratings start empty instead of at 4.8 (like 0086 did for providers)

-- A. Reviews --------------------------------------------------------------------

create or replace function public.reviews_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
begin
  select * into j from public.jobs where id = new.job_id;
  if not found
     or j.customer_id is distinct from new.customer_id
     or j.provider_id is distinct from new.provider_id
     or j.customer_id = j.provider_id
     or j.status <> 'completed' then
    raise exception 'REVIEW_NOT_ALLOWED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_validate on public.reviews;
create trigger reviews_validate
  before insert on public.reviews
  for each row execute function public.reviews_validate();

drop trigger if exists customer_reviews_validate on public.customer_reviews;
create trigger customer_reviews_validate
  before insert on public.customer_reviews
  for each row execute function public.reviews_validate();

-- B. Self-dealing ---------------------------------------------------------------

-- Existing rows are left alone (NOT VALID); every new job is checked.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_distinct_parties') then
    alter table public.jobs
      add constraint jobs_distinct_parties check (customer_id <> provider_id) not valid;
  end if;
end
$$;

-- May the caller send a quote on this request?
create or replace function public.can_quote_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'provider' and p.suspended_at is null
    )
    and exists (
      select 1 from public.service_requests r
      where r.id = p_request_id
        and r.customer_id <> auth.uid()
        and r.status in ('open', 'matching', 'quoted')
        and (r.preferred_provider_id is null or r.preferred_provider_id = auth.uid())
        and (
          r.organization_id is null
          or not exists (
            select 1 from public.organization_members m
            where m.organization_id = r.organization_id and m.profile_id = auth.uid()
          )
        )
        and not public.is_blocked_between(auth.uid(), r.customer_id)
    );
$$;

revoke all on function public.can_quote_request(uuid) from public, anon;
grant execute on function public.can_quote_request(uuid) to authenticated, service_role;

drop policy if exists "providers send their own quotes" on public.quotes;
create policy "providers send their own quotes" on public.quotes
  for insert to authenticated
  with check (auth.uid() = provider_id and public.can_quote_request(request_id));

-- D (needed by the checks below). The subscription switch and the rule -----------

alter table public.platform_config
  add column if not exists subscription_required boolean not null default false;

-- True when the provider may take new work: the switch is off, they have an
-- active subscription, or they have not used their one free job yet.
-- Mirrors workAccess() in api/src/payments/subscription.rules.ts.
create or replace function public.provider_can_take_work(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not coalesce((select pc.subscription_required from public.platform_config pc where pc.id = true), false)
    or coalesce(public.provider_subscription_expiry(p_provider_id) > now(), false)
    or not public.provider_trial_used(p_provider_id);
$$;

revoke all on function public.provider_can_take_work(uuid) from public, anon;
grant execute on function public.provider_can_take_work(uuid) to authenticated, service_role;

create or replace function public.quotes_require_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.provider_can_take_work(new.provider_id) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_require_subscription on public.quotes;
create trigger quotes_require_subscription
  before insert on public.quotes
  for each row execute function public.quotes_require_subscription();

-- Accepting: never your own quote or request; direct requests need the subscription.

create or replace function public.accept_quote(
  p_quote_id uuid,
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
  j public.jobs%rowtype;
  title text;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if q.provider_id = p_customer_id then raise exception 'CANNOT_ACCEPT_OWN_QUOTE'; end if;

  select * into r from public.service_requests where id = q.request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.customer_id <> p_customer_id then raise exception 'NOT_REQUEST_OWNER'; end if;
  if r.status not in ('matching', 'quoted', 'open', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  if exists (select 1 from public.jobs j2 where j2.quote_id = q.id) then
    select * into j from public.jobs where quote_id = q.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
  end if;

  update public.quotes set status = 'accepted', updated_at = now() where id = q.id;
  update public.quotes
    set status = 'declined', updated_at = now()
    where request_id = r.id and id <> q.id and status = 'sent';
  update public.service_requests set status = 'accepted' where id = r.id;

  update public.request_opportunities
    set status = 'QUOTED'
    where request_id = r.id and provider_id = q.provider_id;

  title := trim(split_part(r.category_label, '·', 2));
  if title = '' then title := r.category_label; end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, q.provider_id, title, q.price, r.location_label, 1, 'accepted'
  )
  returning * into j;

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CREATED', 0, 1, 'Job created - waiting for provider to start');

  select * into q from public.quotes where id = p_quote_id;
  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

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
  if r.customer_id = p_provider_id then raise exception 'CANNOT_ACCEPT_OWN_REQUEST'; end if;
  if r.status <> 'awaiting_provider' then raise exception 'REQUEST_NOT_AWAITING'; end if;

  price := coalesce(r.customer_budget, r.budget_min, r.budget_max);
  if price is null or price <= 0 then raise exception 'INVALID_BUDGET'; end if;

  if exists (select 1 from public.jobs j2 where j2.request_id = r.id) then
    select * into j from public.jobs where request_id = r.id limit 1;
    select * into q from public.quotes where id = j.quote_id;
    return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
  end if;

  if not public.provider_can_take_work(p_provider_id) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
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

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created - start work when ready');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '. Agree how you will pay the provider directly. Waiting for them to start.',
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

-- C. Referral rewards -------------------------------------------------------------
-- Same as 0060 plus: the friend's job must not be worked by the referrer, must
-- have run for at least 10 minutes, and one person earns at most 25 rewards.
-- The notification no longer promises a payout (there are none).

create or replace function public.maybe_earn_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
begin
  if new.status <> 'completed' or new.customer_confirmed_at is null then
    return new;
  end if;
  if old.status = 'completed' and old.customer_confirmed_at is not null then
    return new; -- already processed
  end if;

  select * into v_referral
  from public.referrals
  where referred_id = new.customer_id and status = 'pending'
  limit 1;
  if v_referral.id is null then
    return new;
  end if;

  -- A referrer cannot earn from a job they worked themselves, from one that
  -- finished in minutes, or beyond the cap. The referral stays pending.
  if v_referral.referrer_id = new.provider_id
     or coalesce(new.provider_completed_at, now()) - new.started_at < interval '10 minutes'
     or (select count(*) from public.referrals x
         where x.referrer_id = v_referral.referrer_id and x.status in ('earned', 'paid')) >= 25 then
    return new;
  end if;

  update public.referrals
  set status = 'earned', job_id = new.id, reward_amount = 10, earned_at = now()
  where id = v_referral.id
  returning * into v_referral;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_referral.referrer_id,
    'REFERRAL_REWARD_EARNED',
    'Referral reward earned',
    'Your friend completed their first job. GHS 10 referral credit has been recorded for you.',
    jsonb_build_object('jobId', new.id, 'referralId', v_referral.id, 'amount', v_referral.reward_amount)
  );

  return new;
end;
$$;

-- E. Storage limits ---------------------------------------------------------------

update storage.buckets set file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  where id = 'profile-photos';
update storage.buckets set file_size_limit = 60 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
                             'video/mp4', 'video/quicktime', 'video/x-m4v']
  where id = 'portfolio-photos';
update storage.buckets set file_size_limit = 8 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  where id in ('request-photos', 'chat-photos', 'dispute-evidence');
update storage.buckets set file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
  where id = 'verification-docs';
update storage.buckets set file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array['audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/3gpp']
  where id = 'chat-audio';

-- F. No signed-out account lookups -------------------------------------------------
-- Sign-up's early "already registered?" pre-check now only works once signed in;
-- the app already carries on when the check fails, and the unique constraints
-- (0004 for phone, Supabase Auth for email) remain the real guard.

revoke execute on function public.phone_in_use(text, uuid) from anon;
revoke execute on function public.email_in_use(text, uuid) from anon;

-- G. Small leaks -------------------------------------------------------------------

-- Unread count: only your own.
create or replace function public.count_unread_threads(p_user_id uuid, p_role text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.chat_threads t
  where (auth.role() = 'service_role' or p_user_id = auth.uid())
  and (
    (p_role = 'customer' and t.customer_id = p_user_id)
    or (p_role = 'provider' and t.provider_id = p_user_id)
  )
  and exists (
    select 1 from public.chat_messages m
    where m.thread_id = t.id
      and m.sender_id <> p_user_id
      and m.read_at is null
  );
$$;

-- Block status: only visible to the two people involved.
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.role() = 'service_role' or auth.uid() in (p_a, p_b))
    and exists (
      select 1 from public.user_blocks
      where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
    );
$$;

-- Request location: only the request's own customer (or the API) can set it.
create or replace function public.set_request_location_from_label(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.service_requests r
  set location = a.location
  from public.area_centroids a
  where r.id = p_request_id
    and r.location is null
    and (auth.role() = 'service_role' or r.customer_id = auth.uid())
    and (
      r.location_label ilike a.name || '%'
      or r.location_label ilike '%' || a.name || '%'
    );
end;
$$;

-- H. Customer ratings start empty ---------------------------------------------------

alter table public.profiles alter column customer_rating set default 0;

update public.profiles p
set
  customer_rating = coalesce((
    select round(avg(r.rating)::numeric, 1) from public.customer_reviews r where r.customer_id = p.id
  ), 0),
  customer_reviews_count = (
    select count(*)::int from public.customer_reviews r where r.customer_id = p.id
  )
where p.role = 'customer' or p.customer_reviews_count > 0;
