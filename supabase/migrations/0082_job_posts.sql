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
