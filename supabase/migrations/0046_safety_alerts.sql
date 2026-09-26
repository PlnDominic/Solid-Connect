-- Safety alerts: an "I need help" button on active jobs. The alert records
-- who raised it, which job it was on and the last known location, and shows
-- up at the top of the admin panel until an admin resolves it. Emergency
-- numbers are dialled from the phone directly; this is the extra step that
-- lets the Solid Connect team follow up.

create table if not exists public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  lat double precision,
  lng double precision,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_note text,
  resolved_by uuid references public.admins(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists safety_alerts_status_idx on public.safety_alerts (status, created_at desc);

alter table public.safety_alerts enable row level security;

drop policy if exists "people and admins read safety alerts" on public.safety_alerts;
create policy "people and admins read safety alerts" on public.safety_alerts
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "people raise their own safety alerts" on public.safety_alerts;
create policy "people raise their own safety alerts" on public.safety_alerts
  for insert with check (
    user_id = auth.uid()
    and status = 'open'
    and resolved_at is null
    and (
      job_id is null
      or exists (
        select 1 from public.jobs j
        where j.id = job_id and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
      )
    )
  );

-- A stuck button should not flood the queue: at most 5 alerts an hour.
create or replace function public.limit_safety_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.safety_alerts
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'ALERT_RATE_LIMIT';
  end if;
  return new;
end;
$$;

drop trigger if exists safety_alerts_rate_limit on public.safety_alerts;
create trigger safety_alerts_rate_limit
  before insert on public.safety_alerts
  for each row execute function public.limit_safety_alerts();
