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
