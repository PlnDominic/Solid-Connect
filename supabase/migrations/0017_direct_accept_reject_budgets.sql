-- Dual request modes: category budget bands, direct awaiting/reject, in-app notifications.

-- Service catalog budget ranges (GHS)
alter table public.categories
  add column if not exists budget_min integer not null default 200;

alter table public.categories
  add column if not exists budget_max integer not null default 800;

update public.categories set budget_min = 150, budget_max = 900 where id = 'plumbing';
update public.categories set budget_min = 200, budget_max = 1200 where id = 'electrical';
update public.categories set budget_min = 250, budget_max = 1500 where id = 'carpentry';
update public.categories set budget_min = 300, budget_max = 2000 where id = 'masonry';
update public.categories set budget_min = 200, budget_max = 1400 where id = 'painting';
update public.categories set budget_min = 200, budget_max = 1600 where id = 'welding';
update public.categories set budget_min = 150, budget_max = 800 where id = 'cleaning';
update public.categories set budget_min = 180, budget_max = 1000 where id = 'ac_repair';

alter table public.service_requests
  add column if not exists request_mode text not null default 'GENERAL'
    check (request_mode in ('GENERAL', 'DIRECT'));

alter table public.service_requests
  add column if not exists customer_budget integer;

alter table public.service_requests
  add column if not exists rejection_reason text;

-- Expand status enum for direct flow
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests
  add constraint service_requests_status_check
  check (status = any (array[
    'open'::text,
    'matching'::text,
    'awaiting_provider'::text,
    'quoted'::text,
    'accepted'::text,
    'completed'::text,
    'cancelled'::text,
    'rejected'::text
  ]));

-- Backfill mode from preferred_provider_id
update public.service_requests
set request_mode = 'DIRECT'
where preferred_provider_id is not null and request_mode = 'GENERAL';

update public.service_requests
set customer_budget = coalesce(budget_min, budget_max)
where customer_budget is null and (budget_min is not null or budget_max is not null);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

do $$ begin
  create policy "users read own notifications" on public.notifications for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users update own notifications" on public.notifications for update
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Provider accepts a direct request at the customer's stated budget → quote + job.
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
  select * into r from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.request_mode <> 'DIRECT' or r.preferred_provider_id is distinct from p_provider_id then
    raise exception 'NOT_DIRECT_PROVIDER';
  end if;
  if r.status <> 'awaiting_provider' then
    raise exception 'REQUEST_NOT_AWAITING';
  end if;

  price := coalesce(r.customer_budget, r.budget_min, r.budget_max);
  if price is null or price <= 0 then
    raise exception 'INVALID_BUDGET';
  end if;

  -- Idempotent
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
  if title = '' then
    title := r.category_label;
  end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, p_provider_id, title, price, r.location_label, 3, 'in_progress'
  )
  returning * into j;

  insert into public.payments (job_id, amount, status)
  values (j.id, price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '.',
    jsonb_build_object('requestId', r.id, 'jobId', j.id, 'providerId', p_provider_id)
  );

  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

create or replace function public.reject_direct_request(
  p_request_id uuid,
  p_provider_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.service_requests%rowtype;
  reason text;
begin
  reason := nullif(trim(coalesce(p_reason, '')), '');
  if reason is null or char_length(reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into r from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.request_mode <> 'DIRECT' or r.preferred_provider_id is distinct from p_provider_id then
    raise exception 'NOT_DIRECT_PROVIDER';
  end if;
  if r.status <> 'awaiting_provider' then
    raise exception 'REQUEST_NOT_AWAITING';
  end if;

  update public.service_requests
  set status = 'rejected', rejection_reason = reason
  where id = r.id;

  update public.request_opportunities
    set status = 'DISMISSED'
    where request_id = r.id and provider_id = p_provider_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_REJECTED',
    'Provider declined your request',
    reason,
    jsonb_build_object('requestId', r.id, 'providerId', p_provider_id, 'reason', reason)
  );

  select * into r from public.service_requests where id = p_request_id;
  return jsonb_build_object('request', to_jsonb(r));
end;
$$;

grant execute on function public.accept_direct_request to service_role, authenticated;
grant execute on function public.reject_direct_request to service_role, authenticated;
