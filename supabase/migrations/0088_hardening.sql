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
