-- Two-sided reviews: providers rate customers.
--
-- Reviews today (0001_init.sql) only flow customer → provider, with
-- profiles.provider_rating / provider_jobs_count maintained by the
-- apply_review() trigger. reviews carries unique(job_id), so the
-- provider's side needs its own table - one row per (job, provider)
-- mirrors one row per (job, customer) on reviews.
--
-- The aggregate math mirrors apply_review() exactly: a running average
-- that folds the new rating into the old one (same commutative form the
-- admin moderation recomputation relies on, see 0026).

alter table public.profiles
  add column if not exists customer_rating numeric(2,1) not null default 4.8;

alter table public.profiles
  add column if not exists customer_reviews_count integer not null default 0;

-- Every rating is anchored to a completed job both sides actually shared.
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  customer_id uuid not null references public.profiles(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (job_id)
);

create index if not exists customer_reviews_customer_idx on public.customer_reviews(customer_id);

-- Same running-average shape as apply_review() in 0001_init.sql.
create or replace function public.apply_customer_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
  set customer_reviews_count = customer_reviews_count + 1,
      customer_rating = round((
        (p.customer_rating * p.customer_reviews_count + new.rating)
        / (p.customer_reviews_count + 1)
      )::numeric, 1)
  where p.id = new.customer_id;
  return new;
end;
$$;

drop trigger if exists customer_reviews_apply_after_insert on public.customer_reviews;
create trigger customer_reviews_apply_after_insert
  after insert on public.customer_reviews
  for each row execute function public.apply_customer_review();

alter table public.customer_reviews enable row level security;

drop policy if exists "customer reviews are publicly readable" on public.customer_reviews;
create policy "customer reviews are publicly readable" on public.customer_reviews
  for select using (true);

-- Mirror of "customers review their own completed jobs": the provider
-- may rate the customer of a job they actually worked on.
drop policy if exists "providers review their own completed jobs" on public.customer_reviews;
create policy "providers review their own completed jobs" on public.customer_reviews
  for insert with check (auth.uid() = provider_id);

-- ── chat unread badge RPC ───────────────────────────────────────────────
-- Feeds the Chat tab badge (src/api/badges.ts). One call returns the
-- number of threads where my counterpart has at least one message I
-- haven't read - the same definition ChatThreadScreen's mark_thread_read
-- uses (stamps read_at on the other participant's messages).
create or replace function public.count_unread_threads(p_user_id uuid, p_role text)
returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int
  from public.chat_threads t
  where (
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

revoke all on function public.count_unread_threads(uuid, text) from public;
grant execute on function public.count_unread_threads(uuid, text) to authenticated;

-- ── realtime ────────────────────────────────────────────────────────────
-- customer_reviews drives the "rate this customer" prompt on the
-- provider's Jobs list; notifications already refresh on a 15s poll but
-- the badge should move instantly too.
-- Guarded like 0049/0061: re-running must not fail if a table is already
-- published (or the publication doesn't exist locally).
do $$
begin
  begin
    alter publication supabase_realtime add table public.customer_reviews;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
