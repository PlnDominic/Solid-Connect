-- Solid Connect: migrations 0047-0066 in one script.
-- Paste into Supabase Dashboard -> SQL Editor -> Run.
--
-- Runs as a single transaction: if any statement fails, nothing is applied.
-- Every migration here is safe to re-run, so it doesn't matter if some of
-- them were already applied to this project.
--
-- After running: projects WITHOUT Hubtel configured should set the deposit
-- to 0% in admin Settings (or: update public.platform_config set
-- deposit_percent = 0;), otherwise providers can't start jobs (0065).
--
-- Included: 0047, 0049, 0050, 0052, 0053, 0054, 0055, 0056, 0057, 0058, 0059, 0060, 0061, 0062, 0063, 0064, 0065, 0066

begin;

-- ===== 0047_hubtel_payments.sql =====
-- Phase G: Hubtel collection (customer → platform escrow) then payout.
-- `held` means Hubtel confirmed the customer paid and funds sit with Solid Connect.
-- Job confirmation still moves held|pending → released and creates provider_payouts.

alter table public.payments
  add column if not exists gateway text,
  add column if not exists client_reference text,
  add column if not exists checkout_url text,
  add column if not exists gateway_transaction_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists channel text;

create unique index if not exists payments_client_reference_idx
  on public.payments (client_reference)
  where client_reference is not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'held', 'released', 'refunded', 'partially_refunded'));

-- confirm_job_completion also releases escrow (`held`), not only simulated `pending`.
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
  p public.payments%rowtype;
  v_commission numeric;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    select * into p from public.payments where job_id = j.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
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

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id and status in ('pending', 'held')
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  if p.id is not null then
    select commission_percent into v_commission from public.platform_config where id = true;
    v_commission := coalesce(v_commission, 15);
    insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
    values (
      p.id,
      j.provider_id,
      p.amount,
      round(p.amount * v_commission / 100, 2),
      round(p.amount * (1 - v_commission / 100), 2),
      'hubtel_momo'
    )
    on conflict (payment_id) do nothing;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5, 'Customer confirmed completion; payment released');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    'The customer confirmed completion. Payment was released.',
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;

-- ===== 0049_push_outbox.sql =====
-- Phase I: queue device pushes instead of calling Expo from the insert
-- trigger. Nest drains push_outbox, which is the background worker for
-- FCM (Android) and APNs (iOS) through Expo's push service.

create table if not exists public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  push_token text,
  ticket_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  receipt_checked_at timestamptz
);

create index if not exists push_outbox_pending_idx
  on public.push_outbox (created_at)
  where status = 'pending';

alter table public.push_outbox enable row level security;

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_outbox (notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_for_notification();

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

-- ===== 0050_organizations.sql =====
-- Phase K: organization platform — businesses/agencies, members, projects,
-- workforce requests (service_requests owned by an org), and recurring services.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  phone text,
  email text,
  area text,
  owner_id uuid not null references public.profiles(id),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations (owner_id);
create index if not exists organizations_status_idx on public.organizations (status);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create index if not exists organization_members_profile_idx
  on public.organization_members (profile_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  location_label text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_org_idx on public.projects (organization_id, created_at desc);

alter table public.service_requests
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists service_requests_org_idx
  on public.service_requests (organization_id)
  where organization_id is not null;

create index if not exists service_requests_project_idx
  on public.service_requests (project_id)
  where project_id is not null;

create table if not exists public.recurring_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category_id text not null,
  category_label text not null,
  description text not null default '',
  location_label text not null,
  budget integer not null check (budget > 0),
  cadence text not null check (cadence in ('weekly', 'biweekly', 'monthly')),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists recurring_services_due_idx
  on public.recurring_services (next_run_at)
  where active = true;

-- Membership helpers (security definer so RLS can call them).
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.profile_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id
      and m.profile_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.recurring_services enable row level security;

drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations"
  on public.organizations for select
  using (public.is_admin() or public.is_org_member(id));

drop policy if exists "owners update organizations" on public.organizations;
create policy "owners update organizations"
  on public.organizations for update
  using (public.is_admin() or public.is_org_admin(id));

-- Inserts go through Nest (service role). Members can still read membership.
drop policy if exists "members read membership" on public.organization_members;
create policy "members read membership"
  on public.organization_members for select
  using (public.is_admin() or public.is_org_member(organization_id) or profile_id = auth.uid());

drop policy if exists "members read projects" on public.projects;
create policy "members read projects"
  on public.projects for select
  using (public.is_admin() or public.is_org_member(organization_id));

drop policy if exists "members read recurring" on public.recurring_services;
create policy "members read recurring"
  on public.recurring_services for select
  using (public.is_admin() or public.is_org_member(organization_id));

-- ===== 0052_job_en_route_arrived.sql =====
-- "On my way" / "I've arrived": two provider check-ins before work starts.
--
-- Deliberately timestamps on jobs, not new job_status values: the status
-- enum is checked by every job RPC and the client, and these are only
-- sub-states of 'accepted'. Each check-in notifies the customer through the
-- notifications table, which the 0043 trigger delivers as a push.

alter table public.jobs
  add column if not exists en_route_at timestamptz,
  add column if not exists arrived_at timestamptz;

create or replace function public.mark_en_route(
  p_job_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_ACCEPTED'; end if;

  -- Idempotent: a second tap (or a retry) changes nothing and re-notifies nobody.
  if j.en_route_at is not null then
    return to_jsonb(j);
  end if;

  update public.jobs set en_route_at = now() where id = j.id returning * into j;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_EN_ROUTE',
    'Your provider is on the way',
    'Open the job to follow them live.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

create or replace function public.mark_arrived(
  p_job_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.provider_id <> p_provider_id then raise exception 'NOT_JOB_PROVIDER'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_ACCEPTED'; end if;

  if j.arrived_at is not null then
    return to_jsonb(j);
  end if;

  -- Arriving implies being on the way, even if "on my way" was skipped.
  update public.jobs
  set arrived_at = now(), en_route_at = coalesce(en_route_at, now())
  where id = j.id
  returning * into j;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_ARRIVED',
    'Your provider has arrived',
    'They are at your location.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

grant execute on function public.mark_en_route to service_role, authenticated;
grant execute on function public.mark_arrived to service_role, authenticated;

-- ===== 0053_booking_slots.sql =====
-- Slot booking support.
--   A. provider_busy_windows: lets a customer see WHEN a provider is taken
--      (and nothing else) - RLS hides other customers' jobs.
--   B. A provider can't be double-booked: two active jobs may not start
--      within 2 hours of each other.
--
-- 2 hours is the slot length the app books in (src/lib/slots.ts SLOT_HOURS).

-- ── A. Busy windows ──────────────────────────────────────────────────────
create or replace function public.provider_busy_windows(
  p_provider_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select j.scheduled_for
  from public.jobs j
  where j.provider_id = p_provider_id
    and j.status in ('accepted', 'in_progress')
    and j.scheduled_for is not null
    and j.scheduled_for >= p_from - interval '2 hours'
    and j.scheduled_for < p_to;
$$;

revoke all on function public.provider_busy_windows(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.provider_busy_windows(uuid, timestamptz, timestamptz) to authenticated;

-- ── B. No double-booking ─────────────────────────────────────────────────
-- Named to sort after jobs_inherit_request_schedule (0050): triggers on the
-- same event fire alphabetically, and this one must see the inherited time.
create or replace function public.prevent_provider_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scheduled_for is null or new.status not in ('accepted', 'in_progress') then
    return new;
  end if;

  if exists (
    select 1 from public.jobs o
    where o.provider_id = new.provider_id
      and o.id <> new.id
      and o.status in ('accepted', 'in_progress')
      and o.scheduled_for is not null
      and abs(extract(epoch from (o.scheduled_for - new.scheduled_for))) < 2 * 3600
  ) then
    if tg_op = 'INSERT' then
      -- A job created from an accepted quote must still be created. Drop the
      -- clashing time instead; both sides can agree a new one ("Set a time").
      new.scheduled_for := null;
    else
      raise exception 'SLOT_TAKEN' using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_prevent_double_booking on public.jobs;
create trigger jobs_prevent_double_booking
  before insert or update of scheduled_for, status on public.jobs
  for each row execute function public.prevent_provider_double_booking();

-- ===== 0054_dispute_cases.sql =====
-- Disputes as a two-sided case.
--   A. Provider response + "payment already released" flag on disputes.
--   B. Photo evidence from both sides, stored privately.
--   C. Payment hold: a pending payment can't be released while a dispute is
--      open (admins / service_role are exempt so resolution still works).
--   D. Notifications: opened -> provider, responded -> customer,
--      resolved -> both. Triggers, so the admin panel needs no changes.
--   E. Pushes may name their own deep-link url (so a dispute push opens the
--      dispute screen, not just the job).

-- ── A. Columns ───────────────────────────────────────────────────────────
alter table public.disputes
  add column if not exists provider_response text,
  add column if not exists provider_responded_at timestamptz,
  add column if not exists payment_already_released boolean not null default false;

-- ── B. Evidence ──────────────────────────────────────────────────────────
create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id, created_at);

alter table public.dispute_evidence enable row level security;

do $$ begin
  create policy "parties and admins read dispute evidence"
    on public.dispute_evidence for select
    using (
      exists (
        select 1 from public.disputes d
        where d.id = dispute_id and (d.customer_id = auth.uid() or d.provider_id = auth.uid())
      )
      or public.is_admin()
    );
exception when duplicate_object then null; end $$;

-- A party adds their own evidence, only while the case is open.
do $$ begin
  create policy "parties add evidence to open disputes"
    on public.dispute_evidence for insert
    with check (
      author_id = auth.uid()
      and exists (
        select 1 from public.disputes d
        where d.id = dispute_id
          and d.status = 'open'
          and (d.customer_id = auth.uid() or d.provider_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

create or replace function public.limit_dispute_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.dispute_evidence
      where dispute_id = new.dispute_id and author_id = new.author_id) >= 5 then
    raise exception 'EVIDENCE_LIMIT' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists dispute_evidence_limit on public.dispute_evidence;
create trigger dispute_evidence_limit
  before insert on public.dispute_evidence
  for each row execute function public.limit_dispute_evidence();

-- Private bucket: path is <dispute_id>/<author_id>/<file>.
insert into storage.buckets (id, name, public) values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do nothing;

do $$ begin
  create policy "parties upload dispute evidence" on storage.objects for insert
    with check (
      bucket_id = 'dispute-evidence'
      and (storage.foldername(name))[2] = auth.uid()::text
      and exists (
        select 1 from public.disputes d
        where d.id::text = (storage.foldername(name))[1]
          and (d.customer_id = auth.uid() or d.provider_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "parties and admins read dispute evidence files" on storage.objects for select
    using (
      bucket_id = 'dispute-evidence'
      and (
        public.is_admin()
        or exists (
          select 1 from public.disputes d
          where d.id::text = (storage.foldername(name))[1]
            and (d.customer_id = auth.uid() or d.provider_id = auth.uid())
        )
      )
    );
exception when duplicate_object then null; end $$;

-- ── Provider response (once, while open) ────────────────────────────────
create or replace function public.respond_to_dispute(
  p_dispute_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.disputes%rowtype;
  v_text text := trim(coalesce(p_response, ''));
begin
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;
  if auth.uid() is distinct from d.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if d.status <> 'open' then raise exception 'DISPUTE_CLOSED'; end if;
  if d.provider_responded_at is not null then raise exception 'ALREADY_RESPONDED'; end if;
  if v_text = '' then raise exception 'RESPONSE_REQUIRED'; end if;
  if char_length(v_text) > 2000 then raise exception 'RESPONSE_TOO_LONG'; end if;

  update public.disputes
  set provider_response = v_text, provider_responded_at = now()
  where id = d.id
  returning * into d;

  return to_jsonb(d);
end;
$$;

revoke all on function public.respond_to_dispute(uuid, text) from public, anon;
grant execute on function public.respond_to_dispute(uuid, text) to authenticated;

-- ── C. Payment hold ──────────────────────────────────────────────────────
create or replace function public.block_release_during_dispute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'released' and old.status is distinct from 'released'
     and auth.role() <> 'service_role'
     and not public.is_admin()
     and exists (select 1 from public.disputes d where d.job_id = new.job_id and d.status = 'open') then
    raise exception 'PAYMENT_DISPUTED' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_block_release_during_dispute on public.payments;
create trigger payments_block_release_during_dispute
  before update of status on public.payments
  for each row execute function public.block_release_during_dispute();

-- ── D. Notifications + released flag ─────────────────────────────────────
create or replace function public.dispute_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Money already gone before the dispute was filed: nothing to hold, but
  -- ops need to know.
  update public.disputes d
  set payment_already_released = exists (
    select 1 from public.payments p where p.job_id = d.job_id and p.status = 'released'
  )
  where d.id = new.id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.provider_id,
    'DISPUTE_OPENED',
    'A customer opened a dispute',
    'Add your side and any photos so Solid Connect can review it fairly.',
    jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                       'url', 'solidconnect://jobs/' || new.job_id || '/dispute')
  );
  return new;
end;
$$;

drop trigger if exists disputes_after_insert on public.disputes;
create trigger disputes_after_insert
  after insert on public.disputes
  for each row execute function public.dispute_after_insert();

create or replace function public.dispute_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb := jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                                     'url', 'solidconnect://jobs/' || new.job_id || '/dispute');
begin
  if old.provider_responded_at is null and new.provider_responded_at is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.customer_id, 'DISPUTE_RESPONSE', 'The provider responded to your dispute',
            'Open the case to read their side.', v_data);
  end if;

  if old.status = 'open' and new.status = 'resolved' then
    insert into public.notifications (user_id, type, title, body, data)
    values
      (new.customer_id, 'DISPUTE_RESOLVED', 'Your dispute was resolved',
       coalesce(nullif(new.resolution_note, ''), 'Open the case to see the outcome.'), v_data),
      (new.provider_id, 'DISPUTE_RESOLVED', 'A dispute on your job was resolved',
       coalesce(nullif(new.resolution_note, ''), 'Open the case to see the outcome.'), v_data);
  end if;
  return new;
end;
$$;

drop trigger if exists disputes_after_update on public.disputes;
create trigger disputes_after_update
  after update on public.disputes
  for each row execute function public.dispute_after_update();

-- ── E. Push deep links ───────────────────────────────────────────────────
-- 0043's function, unchanged except the url: a notification may carry its
-- own data.url (used by disputes); otherwise the old rules apply.
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
  v_enabled := coalesce((v_prefs ->> v_key)::boolean, v_key <> 'promotions');
  if not v_enabled then
    return new;
  end if;

  v_url := case
    when new.data ? 'url' then new.data ->> 'url'
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
    null;
  end;

  return new;
end;
$$;

-- ===== 0055_quote_negotiation.sql =====
-- Richer, negotiable quotes.
--   A. New columns: line items, proposed start, counter-offer, decline reason.
--   B. Line items must add up to the price.
--   C. Close a hole: customers could UPDATE any column of a quote on their
--      own request (including price, which accept_quote turns into the job's
--      price). They now go through the functions below instead.
--   D. revise_quote / counter_quote / respond_to_counter / decline_quote,
--      each notifying the other side (QUOTE_* types map to the "new quotes"
--      notification preference).

-- ── A. Columns ───────────────────────────────────────────────────────────
alter table public.quotes
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists proposed_start timestamptz,
  add column if not exists counter_price integer,
  add column if not exists counter_note text,
  add column if not exists counter_at timestamptz,
  add column if not exists counter_declined_at timestamptz,
  add column if not exists decline_reason text;

-- ── B. Items add up ──────────────────────────────────────────────────────
-- items: [{"label": "Labour", "amount": 300}, ...] - optional, max 8.
create or replace function public.check_quote_items()
returns trigger
language plpgsql
as $$
declare
  v_count int;
  v_sum bigint;
begin
  if jsonb_typeof(new.items) is distinct from 'array' then
    raise exception 'ITEMS_INVALID';
  end if;
  v_count := jsonb_array_length(new.items);
  if v_count = 0 then
    return new;
  end if;
  if v_count > 8 then raise exception 'ITEMS_INVALID'; end if;

  if exists (
    select 1 from jsonb_array_elements(new.items) e
    where jsonb_typeof(e -> 'amount') is distinct from 'number'
       or (e ->> 'amount')::numeric <= 0
       or (e ->> 'amount')::numeric <> trunc((e ->> 'amount')::numeric)
       or btrim(coalesce(e ->> 'label', '')) = ''
       or char_length(e ->> 'label') > 60
  ) then
    raise exception 'ITEMS_INVALID';
  end if;

  select sum((e ->> 'amount')::numeric)::bigint into v_sum from jsonb_array_elements(new.items) e;
  if v_sum <> new.price then raise exception 'ITEMS_MISMATCH'; end if;
  return new;
end;
$$;

drop trigger if exists quotes_check_items on public.quotes;
create trigger quotes_check_items
  before insert or update of items, price on public.quotes
  for each row execute function public.check_quote_items();

-- ── C. Close the customer UPDATE hole ────────────────────────────────────
drop policy if exists "customers accept/decline quotes on their own requests" on public.quotes;

-- ── D. Functions ─────────────────────────────────────────────────────────
create or replace function public.revise_quote(
  p_quote_id uuid,
  p_price integer,
  p_items jsonb,
  p_note text,
  p_proposed_start timestamptz,
  p_eta_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if auth.uid() is distinct from q.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if p_price is null or p_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into r from public.service_requests where id = q.request_id;
  if r.status not in ('matching', 'quoted', 'open', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  update public.quotes
  set price = p_price,
      items = coalesce(p_items, '[]'::jsonb),
      note = coalesce(p_note, ''),
      proposed_start = p_proposed_start,
      eta_label = coalesce(nullif(btrim(p_eta_label), ''), eta_label),
      revision = revision + 1,
      counter_price = null,
      counter_note = null,
      counter_at = null,
      counter_declined_at = null,
      updated_at = now()
  where id = q.id
  returning * into q;

  insert into public.notifications (user_id, type, title, body, data)
  values (r.customer_id, 'QUOTE_REVISED', 'A provider updated their quote',
          'Open your request to see the new price.',
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

create or replace function public.counter_quote(
  p_quote_id uuid,
  p_price integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into r from public.service_requests where id = q.request_id;
  if auth.uid() is distinct from r.customer_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if q.counter_price is not null then raise exception 'COUNTER_PENDING'; end if;
  if q.counter_declined_at is not null then raise exception 'COUNTER_DECLINED'; end if;
  -- Lower than the quote, and not an insulting lowball.
  if p_price is null or p_price >= q.price or p_price < ceil(q.price * 0.5) then
    raise exception 'INVALID_COUNTER';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  update public.quotes
  set counter_price = p_price,
      counter_note = nullif(btrim(coalesce(p_note, '')), ''),
      counter_at = now(),
      updated_at = now()
  where id = q.id
  returning * into q;

  insert into public.notifications (user_id, type, title, body, data)
  values (q.provider_id, 'QUOTE_COUNTER', 'A customer made a counter-offer',
          'They offered GHS ' || p_price || '. Accept, decline or send a new price.',
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

create or replace function public.respond_to_counter(
  p_quote_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if auth.uid() is distinct from q.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if q.counter_price is null then raise exception 'NO_COUNTER'; end if;
  select * into r from public.service_requests where id = q.request_id;

  if p_accept then
    -- The old breakdown no longer adds up; the provider can add a new one
    -- by revising the quote.
    update public.quotes
    set price = q.counter_price,
        items = '[]'::jsonb,
        revision = revision + 1,
        counter_price = null,
        counter_note = null,
        counter_at = null,
        counter_declined_at = null,
        updated_at = now()
    where id = q.id
    returning * into q;

    insert into public.notifications (user_id, type, title, body, data)
    values (r.customer_id, 'QUOTE_COUNTER_ACCEPTED', 'Your counter-offer was accepted',
            'The quote is now GHS ' || q.price || '. You can accept it to book the job.',
            jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));
  else
    update public.quotes
    set counter_price = null,
        counter_note = null,
        counter_declined_at = now(),
        updated_at = now()
    where id = q.id
    returning * into q;

    insert into public.notifications (user_id, type, title, body, data)
    values (r.customer_id, 'QUOTE_COUNTER_DECLINED', 'Your counter-offer was declined',
            'The original quote still stands.',
            jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));
  end if;

  return to_jsonb(q);
end;
$$;

create or replace function public.decline_quote(
  p_quote_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into r from public.service_requests where id = q.request_id for update;
  if auth.uid() is distinct from r.customer_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;

  update public.quotes
  set status = 'declined',
      decline_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
      counter_price = null,
      counter_note = null,
      counter_at = null,
      updated_at = now()
  where id = q.id
  returning * into q;

  -- Declined the last open quote: the request goes back to collecting
  -- quotes instead of sitting in "quoted" with nothing to show.
  if r.status = 'quoted'
     and not exists (select 1 from public.quotes where request_id = r.id and status = 'sent') then
    update public.service_requests set status = 'matching' where id = r.id;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (q.provider_id, 'QUOTE_DECLINED', 'A customer declined your quote',
          coalesce(q.decline_reason, 'They chose not to go ahead with this quote.'),
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

revoke all on function public.revise_quote(uuid, integer, jsonb, text, timestamptz, text) from public, anon;
revoke all on function public.counter_quote(uuid, integer, text) from public, anon;
revoke all on function public.respond_to_counter(uuid, boolean) from public, anon;
revoke all on function public.decline_quote(uuid, text) from public, anon;
grant execute on function public.revise_quote(uuid, integer, jsonb, text, timestamptz, text) to authenticated;
grant execute on function public.counter_quote(uuid, integer, text) to authenticated;
grant execute on function public.respond_to_counter(uuid, boolean) to authenticated;
grant execute on function public.decline_quote(uuid, text) to authenticated;

-- ===== 0056_platform_config_support_and_payout_defaults.sql =====
-- Two more owner-editable platform settings on the existing singleton
-- config row (0027_payments_admin_tooling.sql), same pattern as
-- commission_percent: read on the Settings page, written by
-- updatePlatformSettings (owner-only, settings/actions.ts).

alter table public.platform_config
  add column if not exists support_email text not null default 'support@solidconnect.co';

-- Nullable on purpose: null means "no default", so the payout method
-- select on /payouts keeps its current blank/required behaviour until an
-- owner actually sets one.
alter table public.platform_config
  add column if not exists default_payout_method text;

-- ===== 0057_restore_push_outbox.sql =====
-- 0049 moved device pushes onto push_outbox (drained by the Nest
-- PushService), but 0054 later redefined send_push_for_notification to call
-- Expo directly again, which left the outbox empty. Put the queue back.
-- 0054's per-notification deep link (data.url) is honoured by the worker's
-- pushDeepLink, so nothing from 0054 is lost.

create or replace function public.send_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_outbox (notification_id, user_id)
  values (new.id, new.user_id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.send_push_for_notification();

-- ===== 0058_chat_voice_notes.sql =====
-- Migration 0058: Chat voice notes
-- Adds audio attachment fields to chat_messages and provisions the chat-audio storage bucket.

-- 1. Add audio fields to chat_messages
alter table public.chat_messages
  add column if not exists audio_url text;

alter table public.chat_messages
  add column if not exists audio_duration_seconds integer;

-- 2. Update content constraint to allow voice notes (text, image, or audio)
alter table public.chat_messages
  drop constraint if exists chat_messages_has_content;

do $$ begin
  alter table public.chat_messages
    add constraint chat_messages_has_content check (
      text is not null or image_url is not null or audio_url is not null
    );
exception when duplicate_object then null; end $$;

-- 3. Provision storage bucket for chat audio files
insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', true)
on conflict (id) do nothing;

do $$ begin
  create policy "chat participants upload their own chat audio" on storage.objects for insert
    with check (
      bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anyone can read chat audio" on storage.objects for select
    using (bucket_id = 'chat-audio');
exception when duplicate_object then null; end $$;

-- ===== 0059_provider_payout_account.sql =====
-- Migration 0059: Provider payout destination account
-- Stores the provider's preferred Mobile Money or bank account configuration
-- for receiving job payouts net of platform commission.

alter table public.profiles
  add column if not exists payout_account jsonb;

comment on column public.profiles.payout_account is
  'Provider payout destination details (MoMo network + phone + account name, or Bank name + account number + account name)';

-- ===== 0060_referral_rewards.sql =====
-- Referral program: real invite codes, attribution at signup, and a
-- reward ledger earned on the referred user's first completed job.
--
-- Replaces the ReferralScreen's fake client-side code (initials + profile
-- id slice) with a server-generated unique code, and the "Rewards ... not
-- live yet" note with a real ledger. Money still isn't real (payments are
-- simulated until a MoMo/card gateway lands - see README "Explicitly still
-- simulated"), so a reward is recorded as credit in `referrals` and paid
-- out as part of Phase G (real provider payouts), not moved by this
-- migration.
--
-- Flow: referrer generates a code (my_referral_code, called by the
-- ReferralScreen) → invitee enters/taps the code → claim_referral() runs
-- after signup (30-day window, one referral per account, no self- or
-- loop-referrals) → the invitee's first confirmed-completed job flips the
-- ledger row pending → earned (maybe_earn_referral_reward trigger) and
-- notifies the referrer.

-- ── referral_codes ─────────────────────────────────────────────────────
-- One code per user. Codes are shared publicly (in chat threads, on
-- flyers), so reads are open to any signed-in user; writes happen only
-- through the SECURITY DEFINER generator below so a user can never grab
-- or overwrite someone else's code.
create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists referral_codes_user_idx on public.referral_codes(user_id);

alter table public.referral_codes enable row level security;

drop policy if exists "authenticated can look up referral codes" on public.referral_codes;
create policy "authenticated can look up referral codes"
  on public.referral_codes for select
  to authenticated
  using (true);

-- ── referrals ──────────────────────────────────────────────────────────
-- The ledger. referred_id is unique: an account can be referred at most
-- once, ever. reward_amount is stamped when the reward is earned so a
-- later change to the program's rate can't rewrite history.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  code_used text not null,
  status text not null default 'pending' check (status in ('pending', 'earned', 'paid')),
  reward_amount integer,
  job_id uuid references public.jobs(id),
  earned_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create index if not exists referrals_referred_idx on public.referrals(referred_id);

alter table public.referrals enable row level security;

drop policy if exists "parties can read their own referrals" on public.referrals;
create policy "parties can read their own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- Status transitions (pending → earned by the trigger below, earned → paid
-- by the eventual payout run) happen server-side only: no insert/update
-- policy is granted, so a client can neither self-award a reward nor
-- rewrite the ledger.

-- ── code generation ────────────────────────────────────────────────────
-- Idempotent: returns the caller's existing code or mints one. Format is
-- up to 4 letters from the profile's name (padded with X for very short
-- names) + 4 unambiguous base32 characters, e.g. KWA-M3P7 without the
-- dash (KWM3P7-style, 8 chars). Collision retries with a fresh suffix.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_prefix text;
  v_suffix text;
  v_attempt integer := 0;
begin
  if auth.uid() is null then
    return null;
  end if;

  select code into v_code from public.referral_codes where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  select coalesce(full_name, '') into v_name from public.profiles where id = auth.uid();
  v_prefix := upper(regexp_replace(coalesce(v_name, ''), '[^A-Za-z]', '', 'g'));
  v_prefix := substr(v_prefix, 1, 4);
  if char_length(v_prefix) < 2 then
    v_prefix := 'SC';
  end if;

  loop
    v_suffix := '';
    for i in 1 .. 4 loop
      v_suffix := v_suffix || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    v_code := rpad(v_prefix, 4, 'X') || v_suffix;
    begin
      insert into public.referral_codes (user_id, code)
      values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 8 then
        raise exception 'REFERRAL_CODE_GENERATION_FAILED';
      end if;
    end;
  end loop;
end;
$$;

-- Pre-claim validation for the sign-up/sign-in UI: resolves a code to the
-- referrer's first name (null when unknown) so the UI can show "Kwame
-- invited you" before the account exists. SECURITY DEFINER so it reads
-- referral_codes without exposing the code → user_id mapping to direct
-- table scans by anonymous users.
create or replace function public.lookup_referral(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(p.full_name, ' ', 1)
  from public.referral_codes rc
  join public.profiles p on p.id = rc.user_id
  where rc.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;

-- ── claiming ───────────────────────────────────────────────────────────
-- Runs as the invitee, right after signup (or a first sign-in inside the
-- window). Guardrails, in order: sane code format; profile exists; within
-- 30 days of account creation; code resolves; not self-referral; no
-- direct loop (A can't be referred by B if B was just referred by A -
-- longer chains are fine); not already referred (belt) with the unique
-- constraint on referred_id as braces (suspenders).
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referrer uuid;
  v_profile public.profiles%rowtype;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(v_code) < 6 then
    raise exception 'INVALID_REFERRAL_CODE';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_profile.created_at < now() - interval '30 days' then
    raise exception 'REFERRAL_WINDOW_CLOSED';
  end if;
  if exists (select 1 from public.referrals where referred_id = auth.uid()) then
    raise exception 'ALREADY_REFERRED';
  end if;

  select user_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null then
    raise exception 'REFERRAL_CODE_NOT_FOUND';
  end if;
  if v_referrer = auth.uid() then
    raise exception 'CANNOT_REFER_YOURSELF';
  end if;
  if exists (
    select 1 from public.referrals
    where referrer_id = auth.uid() and referred_id = v_referrer
  ) then
    raise exception 'REFERRAL_LOOP';
  end if;

  begin
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (v_referrer, auth.uid(), v_code);
  exception when unique_violation then
    raise exception 'ALREADY_REFERRED';
  end;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_referrer,
    'REFERRAL_JOINED',
    'Referral joined',
    v_profile.full_name || ' joined with your code. Your reward is earned when they complete their first job.',
    jsonb_build_object('referredId', auth.uid())
  );

  return true;
end;
$$;

-- ── reward earning ─────────────────────────────────────────────────────
-- A referral is earned when the referred customer's first job completes
-- with customer confirmation - the same moment the (simulated) payment
-- releases in confirm_job_completion. AFTER UPDATE on jobs is the single
-- hook: every completion path (RPC, Nest API) funnels through that update.
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
    return new; -- already processed; confirm_job_completion is idempotent
  end if;

  select * into v_referral
  from public.referrals
  where referred_id = new.customer_id and status = 'pending'
  limit 1;
  if v_referral.id is null then
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
    'Your friend completed their first job. GHS 10 referral credit is yours - it lands with your next payout.',
    jsonb_build_object('jobId', new.id, 'referralId', v_referral.id, 'amount', v_referral.reward_amount)
  );

  return new;
end;
$$;

drop trigger if exists referrals_earn_on_completion on public.jobs;
create trigger referrals_earn_on_completion
  after update of status, customer_confirmed_at on public.jobs
  for each row execute function public.maybe_earn_referral_reward();

grant execute on function public.my_referral_code to authenticated;
grant execute on function public.lookup_referral to anon, authenticated;
grant execute on function public.claim_referral to authenticated;

-- ===== 0061_scheduling_blocks_support_errors.sql =====
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

-- ===== 0062_two_sided_reviews.sql =====
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
alter publication supabase_realtime add table public.customer_reviews;
alter publication supabase_realtime add table public.notifications;

-- ===== 0063_confirm_completion_payment_guard.sql =====
-- Money guards on confirm_job_completion (last defined in 0047).
--
-- 1. An unpaid (`pending`) payment is no longer released when a customer
--    calls this RPC directly. Before, a customer could skip Hubtel, call the
--    RPC to flip the payment to `released` and queue a payout, then hit the
--    API's confirm endpoint, whose "must be paid" check only looks for
--    `pending` - and the API would send the provider real Mobile Money for
--    a job nobody paid for. Only the API (service_role), which has already
--    run its own gateway check, may release a `pending` row (local/dev
--    setups without Hubtel).
-- 2. A provider payout is only queued for a payment that was actually
--    released.
-- 3. An open dispute blocks confirmation for everyone. 0054's payment hold
--    trigger exempts service_role, so confirming through the API used to
--    release a disputed payment anyway.

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
  p public.payments%rowtype;
  v_commission numeric;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    select * into p from public.payments where job_id = j.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
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

  if exists (select 1 from public.disputes d where d.job_id = j.id and d.status = 'open') then
    raise exception 'PAYMENT_DISPUTED' using errcode = '55000';
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

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id
    and (status = 'held' or (status = 'pending' and auth.role() = 'service_role'))
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  if p.id is not null and p.status = 'released' then
    select commission_percent into v_commission from public.platform_config where id = true;
    v_commission := coalesce(v_commission, 15);
    insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
    values (
      p.id,
      j.provider_id,
      p.amount,
      round(p.amount * v_commission / 100, 2),
      round(p.amount * (1 - v_commission / 100), 2),
      'hubtel_momo'
    )
    on conflict (payment_id) do nothing;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (
    j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5,
    case when p.status = 'released'
      then 'Customer confirmed completion; payment released'
      else 'Customer confirmed completion; payment not yet received'
    end
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    case when p.status = 'released'
      then 'The customer confirmed completion. Payment was released.'
      else 'The customer confirmed completion. Payment will follow once it is received.'
    end,
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;

-- ===== 0064_quote_badges_and_payment_insert.sql =====
-- Provider-journey fixes.
--
-- 1. Quotes from providers who aren't verified were stamped "Identity
--    verified": the badge column only allowed 'certified' or 'verified', so
--    everyone who wasn't certified fell through to verified. Allow an honest
--    'unverified' badge.
-- 2. Customers no longer create payment rows themselves - accept_quote and
--    accept_direct_request (SECURITY DEFINER) do it. The leftover insert
--    policy from 0041 only let a customer add extra 'pending' rows to their
--    own job, which makes the API's one-payment-per-job lookup fail and can
--    wedge the job so the provider is never paid.

alter table public.quotes drop constraint if exists quotes_badge_kind_check;
alter table public.quotes
  add constraint quotes_badge_kind_check check (badge_kind in ('certified', 'verified', 'unverified'));

drop policy if exists "job customer opens a pending payment" on public.payments;

-- ===== 0065_deposit_and_balance.sql =====
-- Deposit + balance, both paid to Solid Connect.
--
-- Customers never pay providers directly. A booking is secured by a deposit
-- (platform_config.deposit_percent of the price, default 30%) paid through
-- Hubtel; the balance is paid after the provider finishes; Solid Connect
-- releases the whole amount, minus commission, when the customer confirms.
--
--   pending      - nothing paid; the provider can't travel or start
--   deposit_held - deposit received; booking secured
--   held         - deposit + balance received; customer can confirm
--   released     - paid out to the provider
--   forfeited    - customer cancelled after paying the deposit; kept, with
--                  cancel_compensation_percent of it paid to the provider
--   refunded / partially_refunded - as before (refunds are actioned by ops)
--
-- deposit_percent = 0 turns deposits off (one payment, as before) - use it
-- for setups without Hubtel.

-- ── Settings ────────────────────────────────────────────────────────────
alter table public.platform_config
  add column if not exists deposit_percent numeric not null default 30
    check (deposit_percent between 0 and 100),
  add column if not exists cancel_compensation_percent numeric not null default 50
    check (cancel_compensation_percent between 0 and 100);

-- ── Payment columns ─────────────────────────────────────────────────────
-- Existing rows get deposit_amount 0: bookings made before this change
-- carry on as single payments.
alter table public.payments
  add column if not exists deposit_amount integer not null default 0 check (deposit_amount >= 0),
  add column if not exists deposit_reference text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_transaction_id text;

create unique index if not exists payments_deposit_reference_idx
  on public.payments (deposit_reference) where deposit_reference is not null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'deposit_held', 'held', 'released', 'refunded', 'partially_refunded', 'forfeited'));

-- Every new booking's payment gets its deposit from the current setting.
-- accept_quote / accept_direct_request create the row, so neither needs to
-- change.
create or replace function public.set_payment_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct numeric;
begin
  select deposit_percent into v_pct from public.platform_config where id = true;
  new.deposit_amount := round(new.amount * coalesce(v_pct, 30) / 100);
  return new;
end;
$$;

drop trigger if exists payments_set_deposit on public.payments;
create trigger payments_set_deposit
  before insert on public.payments
  for each row execute function public.set_payment_deposit();

-- ── No travel or work before the deposit ────────────────────────────────
create or replace function public.require_deposit_before_work()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'in_progress' and old.status is distinct from 'in_progress')
     or (new.en_route_at is not null and old.en_route_at is null)
     or (new.arrived_at is not null and old.arrived_at is null) then
    if exists (
      select 1 from public.payments p
      where p.job_id = new.id
        and p.deposit_amount > 0
        and p.status = 'pending'
    ) then
      raise exception 'DEPOSIT_REQUIRED' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_require_deposit on public.jobs;
create trigger jobs_require_deposit
  before update on public.jobs
  for each row execute function public.require_deposit_before_work();

-- ── Confirmation needs the full amount ──────────────────────────────────
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
  p public.payments%rowtype;
  v_commission numeric;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.customer_id <> p_customer_id then raise exception 'NOT_JOB_CUSTOMER'; end if;
  if j.status = 'completed' and j.customer_confirmed_at is not null then
    select * into p from public.payments where job_id = j.id limit 1;
    return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
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

  if exists (select 1 from public.disputes d where d.job_id = j.id and d.status = 'open') then
    raise exception 'PAYMENT_DISPUTED' using errcode = '55000';
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

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id
    -- Fully paid (deposit + balance). Only the API (service_role), which has
    -- run its own gateway check, may release a partly paid row - that only
    -- happens on setups without Hubtel.
    and (status = 'held' or (status in ('pending', 'deposit_held') and auth.role() = 'service_role'))
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
  end if;

  if p.id is not null and p.status = 'released' then
    select commission_percent into v_commission from public.platform_config where id = true;
    v_commission := coalesce(v_commission, 15);
    insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
    values (
      p.id,
      j.provider_id,
      p.amount,
      round(p.amount * v_commission / 100, 2),
      round(p.amount * (1 - v_commission / 100), 2),
      'hubtel_momo'
    )
    on conflict (payment_id) do nothing;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (
    j.id, p_customer_id, 'CUSTOMER_CONFIRMED', j.step, 5,
    case when p.status = 'released'
      then 'Customer confirmed completion; payment released'
      else 'Customer confirmed completion; payment not yet received'
    end
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.provider_id,
    'JOB_COMPLETED',
    'Job completed',
    case when p.status = 'released'
      then 'The customer confirmed completion. Payment was released.'
      else 'The customer confirmed completion. Payment will follow once it is received.'
    end,
    jsonb_build_object('jobId', j.id, 'customerId', p_customer_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'payment', to_jsonb(p));
end;
$$;

-- ── Cancelling after the deposit ────────────────────────────────────────
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
  v_customer_side boolean;
  p public.payments%rowtype;
  v_comp_pct numeric;
  v_comp numeric;
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
  -- Money. Who carries the cost of a cancelled booking: the customer when
  -- they back out (any cancellation by the customer except a provider
  -- no-show, or the provider reporting the customer didn't show), the
  -- provider otherwise. A customer whose provider is unavailable should
  -- report a no-show or open a dispute; admins can still refund.
  v_customer_side := (v_is_customer and p_reason <> 'no_show_provider') or p_reason = 'no_show_customer';

  select * into p from public.payments where job_id = j.id limit 1 for update;
  if found then
    if p.status = 'pending' then
      -- Nothing was paid; just close the ledger row.
      if p_reason <> 'no_show_customer' then
        update public.payments
        set status = 'refunded',
            refund_reason = 'Job cancelled (' || p_reason || ')',
            refund_amount = null
        where id = p.id;
      end if;
    elsif p.status = 'deposit_held' then
      if v_customer_side then
        -- Deposit kept by Solid Connect; part of it compensates the provider.
        select cancel_compensation_percent into v_comp_pct from public.platform_config where id = true;
        v_comp := round(p.deposit_amount * coalesce(v_comp_pct, 50) / 100, 2);
        update public.payments
        set status = 'forfeited',
            refund_reason = 'Deposit kept: customer cancelled (' || p_reason || ')',
            refund_amount = null
        where id = p.id;
        if v_comp > 0 then
          insert into public.provider_payouts (payment_id, provider_id, gross_amount, commission_amount, net_amount, payout_method)
          values (p.id, j.provider_id, p.deposit_amount, p.deposit_amount - v_comp, v_comp, 'hubtel_momo')
          on conflict (payment_id) do nothing;
          insert into public.notifications (user_id, type, title, body, data)
          values (
            j.provider_id,
            'CANCELLATION_COMPENSATION',
            'Cancellation compensation',
            'The customer cancelled after paying a deposit. You will receive GHS ' || v_comp || '.',
            jsonb_build_object('jobId', j.id)
          );
        end if;
      else
        -- Provider's side: the customer gets the deposit back (paid out by ops).
        update public.payments
        set status = 'refunded',
            refund_reason = 'Deposit refund due: job cancelled (' || p_reason || ')',
            refund_amount = p.deposit_amount
        where id = p.id;
      end if;
    elsif p.status = 'held' then
      -- Paid in full before cancelling (older bookings): refund due, ops decide.
      update public.payments
      set status = 'refunded',
          refund_reason = 'Refund due: job cancelled (' || p_reason || ')',
          refund_amount = null
      where id = p.id;
    end if;
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

-- ── Provider escalation: unpaid balance ─────────────────────────────────
alter table public.disputes drop constraint if exists disputes_reason_check;
alter table public.disputes
  add constraint disputes_reason_check
  check (reason in ('not_completed', 'poor_quality', 'overcharged', 'no_show', 'other', 'unpaid_balance'));

-- 72 hours after the provider finishes, if the customer still hasn't paid
-- the balance and confirmed, the provider can hand it to Solid Connect.
-- Opens the job's dispute (one per job); the deposit stays held meanwhile.
create or replace function public.report_unpaid_balance(p_job_id uuid, p_note text default '')
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs%rowtype;
  d public.disputes%rowtype;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if auth.uid() is distinct from j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if j.status <> 'awaiting_completion_confirmation' then raise exception 'JOB_NOT_AWAITING_PAYMENT'; end if;
  if j.provider_completed_at is null or j.provider_completed_at > now() - interval '72 hours' then
    raise exception 'TOO_EARLY_TO_REPORT';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into d from public.disputes where job_id = j.id limit 1;
  if found then raise exception 'DISPUTE_EXISTS'; end if;

  insert into public.disputes (job_id, customer_id, provider_id, reason, description)
  values (
    j.id, j.customer_id, j.provider_id, 'unpaid_balance',
    coalesce(nullif(trim(p_note), ''), 'The provider finished the job but the balance has not been paid or the job confirmed.')
  )
  returning * into d;
  return d;
end;
$$;

revoke all on function public.report_unpaid_balance(uuid, text) from public, anon;
grant execute on function public.report_unpaid_balance(uuid, text) to authenticated;

-- A provider-reported unpaid balance notifies the customer, not the provider.
create or replace function public.dispute_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Money already gone before the dispute was filed: nothing to hold, but
  -- ops need to know.
  update public.disputes d
  set payment_already_released = exists (
    select 1 from public.payments p where p.job_id = d.job_id and p.status = 'released'
  )
  where d.id = new.id;

  -- A provider reporting an unpaid balance: tell the customer instead.
  if new.reason = 'unpaid_balance' then
    insert into public.notifications (user_id, type, title, body, data)
    values (
      new.customer_id,
      'BALANCE_UNPAID_REPORTED',
      'Unpaid balance reported',
      'The provider reported the balance for this job as unpaid. Solid Connect will review it - pay the balance or add your side now.',
      jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                         'url', 'solidconnect://jobs/' || new.job_id || '/dispute')
    );
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.provider_id,
    'DISPUTE_OPENED',
    'A customer opened a dispute',
    'Add your side and any photos so Solid Connect can review it fairly.',
    jsonb_build_object('jobId', new.job_id, 'disputeId', new.id,
                       'url', 'solidconnect://jobs/' || new.job_id || '/dispute')
  );
  return new;
end;
$$;

-- ── Balance reminders ───────────────────────────────────────────────────
-- Run hourly. Customers get at most two reminders (about 24h and 48h after
-- the provider finished); the provider is told once, at 72h, that they can
-- report the balance.
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
    select j.id, j.customer_id, j.provider_id, j.title, j.provider_completed_at, p.status as pay_status
    from public.jobs j
    join public.payments p on p.job_id = j.id
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
        case when r.pay_status = 'held' then 'Confirm your job' else 'Balance due' end,
        case when r.pay_status = 'held'
          then '"' || r.title || '" is finished. Confirm it so the provider can be paid.'
          else '"' || r.title || '" is finished. Pay the balance to Solid Connect and confirm the job.'
        end,
        jsonb_build_object('jobId', r.id)
      );
    end if;

    if r.provider_completed_at < now() - interval '72 hours'
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.provider_id and n.type = 'BALANCE_REPORT_AVAILABLE' and n.data ->> 'jobId' = r.id::text
       ) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.provider_id,
        'BALANCE_REPORT_AVAILABLE',
        'Still waiting on the customer',
        'You can now report the unpaid balance for "' || r.title || '" and Solid Connect will step in.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_balance_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'balance-reminders') then
    perform cron.schedule('balance-reminders', '15 * * * *', $sql$select public.send_balance_reminders();$sql$);
  end if;
end
$$;

-- ===== 0066_deposit_reminders.sql =====
-- Deposit reminders (follows 0065).
--
-- 1. When a provider accepts a direct request, the customer's notification
--    asks for the deposit (with the amount) instead of saying "waiting for
--    the provider to start" - nothing starts until the deposit is paid.
-- 2. The hourly reminder job also nudges customers whose booking deposit is
--    still unpaid: about 3 hours after booking, and once more at 24 hours.
--    Covers bookings from accepted quotes as well as direct requests.
--    send_balance_reminders keeps its name so the existing cron job
--    ('balance-reminders') picks this up with no rescheduling.

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
  v_deposit integer;
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

  insert into public.payments (job_id, amount, status)
  values (j.id, price, 'pending')
  returning deposit_amount into v_deposit;

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created — start work when ready');

  -- With deposits on (0065) nothing starts until the customer pays one, so
  -- say so - and how much - rather than "waiting for the provider".
  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    case when coalesce(v_deposit, 0) > 0
      then 'Provider accepted - pay your deposit'
      else 'Provider accepted your request'
    end,
    case when coalesce(v_deposit, 0) > 0
      then 'Your job is set at GHS ' || price::text || '. Pay a GHS ' || v_deposit::text
           || ' deposit to Solid Connect to secure the booking - the provider starts once it is in.'
      else 'Your job is set up at GHS ' || price::text || '. Waiting for the provider to start.'
    end,
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

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
  -- Deposit nudges: a booking whose deposit still isn't paid, about 3 and
  -- 24 hours after it was made. Nothing can start until it is.
  for r in
    select j.id, j.customer_id, j.title, j.created_at, p.deposit_amount
    from public.jobs j
    join public.payments p on p.job_id = j.id
    where j.status = 'accepted'
      and p.status = 'pending'
      and p.deposit_amount > 0
      and j.created_at < now() - interval '3 hours'
  loop
    select count(*) into v_sent from public.notifications n
    where n.user_id = r.customer_id and n.type = 'DEPOSIT_REMINDER' and n.data ->> 'jobId' = r.id::text;

    if v_sent = 0 or (v_sent = 1 and r.created_at < now() - interval '24 hours'
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.customer_id and n.type = 'DEPOSIT_REMINDER'
           and n.data ->> 'jobId' = r.id::text and n.created_at > now() - interval '20 hours'
       )) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.customer_id,
        'DEPOSIT_REMINDER',
        'Secure your booking',
        'Pay the GHS ' || r.deposit_amount || ' deposit for "' || r.title
          || '" to Solid Connect. The provider can''t start until it''s in.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;

  for r in
    select j.id, j.customer_id, j.provider_id, j.title, j.provider_completed_at, p.status as pay_status
    from public.jobs j
    join public.payments p on p.job_id = j.id
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
        case when r.pay_status = 'held' then 'Confirm your job' else 'Balance due' end,
        case when r.pay_status = 'held'
          then '"' || r.title || '" is finished. Confirm it so the provider can be paid.'
          else '"' || r.title || '" is finished. Pay the balance to Solid Connect and confirm the job.'
        end,
        jsonb_build_object('jobId', r.id)
      );
    end if;

    if r.provider_completed_at < now() - interval '72 hours'
       and not exists (
         select 1 from public.notifications n
         where n.user_id = r.provider_id and n.type = 'BALANCE_REPORT_AVAILABLE' and n.data ->> 'jobId' = r.id::text
       ) then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        r.provider_id,
        'BALANCE_REPORT_AVAILABLE',
        'Still waiting on the customer',
        'You can now report the unpaid balance for "' || r.title || '" and Solid Connect will step in.',
        jsonb_build_object('jobId', r.id)
      );
    end if;
  end loop;
end;
$$;

commit;
