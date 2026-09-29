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
