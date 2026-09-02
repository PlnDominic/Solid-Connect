-- Solid Connect — initial schema
-- MVP scope: profiles (customer/provider, role-switchable), categories, service
-- requests, quotes, jobs, simulated payments, reviews, chat, saved providers.
-- Auth: Supabase anonymous auth (one identity per device install, no OTP) —
-- profiles.id is NOT a hard FK to auth.users so seed/demo rows can exist
-- alongside real device identities; RLS just compares auth.uid() = id.

create extension if not exists "pgcrypto";

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'customer' check (role in ('customer', 'provider')),
  full_name text not null,
  initials text not null,
  area text not null default 'East Legon, Accra',
  is_seed boolean not null default false,
  -- provider-facing fields (populated when role = 'provider')
  provider_category text,
  provider_rating numeric(2,1) not null default 4.8,
  provider_jobs_count integer not null default 0,
  provider_distance_km numeric(3,1),
  provider_verified boolean not null default false,
  provider_certified boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per app identity (real anonymous-auth device, or a seeded demo provider/customer). role is switchable, matching the prototype''s customer/provider switcher.';

-- ── categories ──────────────────────────────────────────────────────────
create table public.categories (
  id text primary key,
  name text not null,
  abbr text not null,
  default_label text not null,
  sort_order integer not null default 0
);

-- ── service_requests ───────────────────────────────────────────────────
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  category_id text references public.categories(id),
  category_label text not null,
  description text not null default '',
  photos text[] not null default '{}',
  budget_min integer,
  budget_max integer,
  location_label text not null default 'East Legon, Accra',
  status text not null default 'open'
    check (status in ('open', 'matching', 'quoted', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index service_requests_customer_idx on public.service_requests(customer_id);
create index service_requests_status_idx on public.service_requests(status);

-- ── quotes ──────────────────────────────────────────────────────────────
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  price integer not null,
  eta_label text not null default 'Today',
  badge_label text not null default 'Identity verified',
  badge_kind text not null default 'verified' check (badge_kind in ('certified', 'verified')),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index quotes_request_idx on public.quotes(request_id);
create index quotes_provider_idx on public.quotes(provider_id);

-- ── jobs ────────────────────────────────────────────────────────────────
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id),
  quote_id uuid not null references public.quotes(id),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  title text not null,
  price integer not null,
  location_label text not null,
  step integer not null default 1 check (step between 1 and 5),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index jobs_customer_idx on public.jobs(customer_id);
create index jobs_provider_idx on public.jobs(provider_id);

-- ── payments (simulated — no real money movement) ─────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  amount integer not null,
  status text not null default 'pending' check (status in ('pending', 'released', 'refunded')),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_job_idx on public.payments(job_id);

-- ── reviews ─────────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.profiles(id),
  customer_id uuid not null references public.profiles(id),
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (job_id)
);

-- keep profiles.provider_rating / provider_jobs_count in sync with reviews
create function public.apply_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
  set provider_jobs_count = provider_jobs_count + 1,
      provider_rating = round((
        (p.provider_rating * p.provider_jobs_count + new.rating)
        / (p.provider_jobs_count + 1)
      )::numeric, 1)
  where p.id = new.provider_id;
  return new;
end;
$$;

create trigger reviews_apply_after_insert
  after insert on public.reviews
  for each row execute function public.apply_review();

-- ── chat ────────────────────────────────────────────────────────────────
create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id),
  job_id uuid references public.jobs(id),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (request_id, provider_id)
);

create index chat_threads_customer_idx on public.chat_threads(customer_id);
create index chat_threads_provider_idx on public.chat_threads(provider_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_role text not null check (sender_role in ('customer', 'provider')),
  text text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_thread_idx on public.chat_messages(thread_id, created_at);

-- ── saved providers ─────────────────────────────────────────────────────
create table public.saved_providers (
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (customer_id, provider_id)
);

-- ── row level security ─────────────────────────────────────────────────
-- Demo/MVP-scoped policies: broad reads (it's a browsable marketplace),
-- writes scoped to auth.uid() with a couple of deliberate relaxations
-- (documented inline) so the client can drive the prototype's "seeded
-- demo data" interactions (e.g. the Skip ahead / simulate-quotes button)
-- without a service-role backend. Tighten before a real production launch.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.service_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.saved_providers enable row level security;

create policy "profiles are publicly readable" on public.profiles
  for select using (true);
create policy "users can create their own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "categories are publicly readable" on public.categories
  for select using (true);

create policy "requests are publicly readable" on public.service_requests
  for select using (true);
create policy "customers create their own requests" on public.service_requests
  for insert with check (auth.uid() = customer_id);
create policy "customers update their own requests" on public.service_requests
  for update using (auth.uid() = customer_id);

create policy "quotes are publicly readable" on public.quotes
  for select using (true);
-- a provider sends their own quote; the client is also allowed to insert a
-- quote on behalf of a seeded demo provider (mirrors the prototype's
-- "3 quotes just came in" simulate button — no seed device exists to send
-- these itself).
create policy "providers or the simulate button can send quotes" on public.quotes
  for insert with check (
    auth.uid() = provider_id
    or exists (select 1 from public.profiles where id = provider_id and is_seed = true)
  );
create policy "customers accept/decline quotes on their own requests" on public.quotes
  for update using (
    exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.customer_id = auth.uid()
    )
  );

create policy "jobs are publicly readable" on public.jobs
  for select using (true);
create policy "customers create jobs by accepting a quote" on public.jobs
  for insert with check (auth.uid() = customer_id);
create policy "customer or provider can update their job" on public.jobs
  for update using (auth.uid() = customer_id or auth.uid() = provider_id);

create policy "payments are publicly readable" on public.payments
  for select using (true);
create policy "the job's customer manages its payment" on public.payments
  for insert with check (
    exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
  );
create policy "the job's customer updates its payment" on public.payments
  for update using (
    exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = auth.uid())
  );

create policy "reviews are publicly readable" on public.reviews
  for select using (true);
create policy "customers review their own completed jobs" on public.reviews
  for insert with check (auth.uid() = customer_id);

create policy "chat threads visible to their participants" on public.chat_threads
  for select using (auth.uid() = customer_id or auth.uid() = provider_id);
create policy "customers open a thread on their own request" on public.chat_threads
  for insert with check (auth.uid() = customer_id);

create policy "messages visible to thread participants" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and (t.customer_id = auth.uid() or t.provider_id = auth.uid())
    )
  );
create policy "participants send messages as themselves" on public.chat_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and (t.customer_id = auth.uid() or t.provider_id = auth.uid())
    )
  );

create policy "saved providers are publicly readable" on public.saved_providers
  for select using (true);
create policy "customers manage their own saved providers" on public.saved_providers
  for insert with check (auth.uid() = customer_id);
create policy "customers remove their own saved providers" on public.saved_providers
  for delete using (auth.uid() = customer_id);

-- realtime for chat
alter publication supabase_realtime add table public.chat_messages;
