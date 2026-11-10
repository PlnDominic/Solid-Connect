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
