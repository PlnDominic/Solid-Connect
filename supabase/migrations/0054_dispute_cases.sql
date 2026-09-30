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
