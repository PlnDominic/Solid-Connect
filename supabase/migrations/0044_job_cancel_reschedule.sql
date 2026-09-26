-- Job cancellation, no-show handling and rescheduling.
--
-- * cancel_job: either party can cancel before work starts; only the
--   provider can cancel once work is in progress (a customer who wants out
--   mid-job opens a dispute instead). No-show cancellations are only
--   allowed 30 minutes after the scheduled (or start) time, and only by
--   the party who was left waiting.
-- * propose_reschedule / respond_reschedule: either party proposes a new
--   time for a job that hasn't started; the other accepts or declines.
--   This is also how a first appointment time gets set (scheduled_for).
--
-- All money and state changes happen inside SECURITY DEFINER functions.

-- jobs: cancelled status + audit columns + scheduled time
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check
  check (status = any (array[
    'accepted'::text,
    'in_progress'::text,
    'awaiting_completion_confirmation'::text,
    'completed'::text,
    'cancelled'::text
  ]));

alter table public.jobs
  add column if not exists scheduled_for timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancel_reason text,
  add column if not exists cancel_note text;

alter table public.job_events drop constraint if exists job_events_event_type_check;
alter table public.job_events
  add constraint job_events_event_type_check
  check (event_type = any (array[
    'CREATED'::text,
    'STARTED'::text,
    'FINISHED'::text,
    'STEP_ADVANCED'::text,
    'PROVIDER_COMPLETED'::text,
    'CUSTOMER_CONFIRMED'::text,
    'MESSAGE_HINT'::text,
    'CANCELLED'::text,
    'RESCHEDULE_PROPOSED'::text,
    'RESCHEDULE_ACCEPTED'::text,
    'RESCHEDULE_DECLINED'::text
  ]));

-- reschedule proposals
create table if not exists public.job_reschedules (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  proposed_for timestamptz not null,
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists job_reschedules_job_idx on public.job_reschedules (job_id, created_at desc);

alter table public.job_reschedules enable row level security;

drop policy if exists "job parties and admins read reschedules" on public.job_reschedules;
create policy "job parties and admins read reschedules" on public.job_reschedules
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = job_reschedules.job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

-- cancel_job
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

  -- The customer's money goes back unless the customer was the no-show;
  -- that case stays pending for an admin to decide (e.g. a call-out fee).
  if p_reason <> 'no_show_customer' then
    update public.payments
    set status = 'refunded',
        refund_reason = 'Job cancelled (' || p_reason || ')',
        refund_amount = null
    where job_id = j.id and status = 'pending';
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

-- propose_reschedule
create or replace function public.propose_reschedule(
  p_job_id uuid,
  p_proposed_for timestamptz,
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
  v_other uuid;
  r public.job_reschedules%rowtype;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if v_uid <> j.customer_id and v_uid <> j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if j.status <> 'accepted' then raise exception 'JOB_ALREADY_STARTED'; end if;
  if p_proposed_for < now() + interval '15 minutes' then raise exception 'TIME_IN_PAST'; end if;
  if p_proposed_for > now() + interval '90 days' then raise exception 'TIME_TOO_FAR'; end if;

  v_other := case when v_uid = j.customer_id then j.provider_id else j.customer_id end;

  update public.job_reschedules
  set status = 'cancelled', responded_at = now()
  where job_id = j.id and status = 'pending';

  insert into public.job_reschedules (job_id, proposed_by, proposed_for, note)
  values (j.id, v_uid, p_proposed_for, coalesce(trim(p_note), ''))
  returning * into r;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, v_uid, 'RESCHEDULE_PROPOSED', j.step, j.step, to_char(p_proposed_for at time zone 'utc', 'YYYY-MM-DD HH24:MI') || ' UTC');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_other,
    'RESCHEDULE_PROPOSED',
    'New time proposed',
    'A new time was proposed for "' || j.title || '". Open the job to accept or decline.',
    jsonb_build_object('jobId', j.id, 'rescheduleId', r.id)
  );

  return to_jsonb(r);
end;
$$;

-- respond_reschedule
create or replace function public.respond_reschedule(
  p_reschedule_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.job_reschedules%rowtype;
  j public.jobs%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into r from public.job_reschedules where id = p_reschedule_id for update;
  if not found then raise exception 'RESCHEDULE_NOT_FOUND'; end if;
  if r.status <> 'pending' then raise exception 'RESCHEDULE_NOT_PENDING'; end if;

  select * into j from public.jobs where id = r.job_id for update;
  if v_uid <> j.customer_id and v_uid <> j.provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_uid = r.proposed_by then raise exception 'CANNOT_ANSWER_OWN_PROPOSAL'; end if;
  if j.status <> 'accepted' then raise exception 'JOB_ALREADY_STARTED'; end if;

  if p_accept and r.proposed_for < now() then raise exception 'TIME_IN_PAST'; end if;

  update public.job_reschedules
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = r.id
  returning * into r;

  if p_accept then
    update public.jobs set scheduled_for = r.proposed_for where id = j.id;
  end if;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, v_uid, case when p_accept then 'RESCHEDULE_ACCEPTED' else 'RESCHEDULE_DECLINED' end, j.step, j.step, null);

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.proposed_by,
    case when p_accept then 'RESCHEDULE_ACCEPTED' else 'RESCHEDULE_DECLINED' end,
    case when p_accept then 'New time confirmed' else 'New time declined' end,
    case when p_accept then 'Your proposed time for "' || j.title || '" was accepted.'
         else 'Your proposed time for "' || j.title || '" was declined.' end,
    jsonb_build_object('jobId', j.id, 'rescheduleId', r.id)
  );

  return to_jsonb(r);
end;
$$;

revoke all on function public.cancel_job(uuid, text, text) from public, anon;
revoke all on function public.propose_reschedule(uuid, timestamptz, text) from public, anon;
revoke all on function public.respond_reschedule(uuid, boolean) from public, anon;
grant execute on function public.cancel_job(uuid, text, text) to authenticated, service_role;
grant execute on function public.propose_reschedule(uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.respond_reschedule(uuid, boolean) to authenticated, service_role;

-- Live updates so the other party sees a proposal the moment it lands.
do $$
begin
  begin
    alter publication supabase_realtime add table public.job_reschedules;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
