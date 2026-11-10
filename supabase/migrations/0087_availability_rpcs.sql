-- Manage provider availability straight from the app (no Nest API needed).
--
-- Until now the Availability screen only worked when the API was deployed,
-- because profiles.availability_mode is locked against direct writes (0078)
-- and only the API's service role could change it. These two functions let a
-- signed-in provider change their own availability, and nothing else:
--
--   set_my_availability_mode(mode)      - AVAILABLE_NOW / SCHEDULE / UNAVAILABLE / PAUSED
--   replace_my_weekly_availability(...) - their weekly hours; switches them to SCHEDULE
--
-- They mirror the API's setAvailabilityMode / replaceWeeklyAvailability:
-- becoming eligible again (AVAILABLE_NOW or SCHEDULE) also re-runs matching
-- for requests already open (sync_provider_opportunities, 0013).
-- Requires migration 0012 (the provider_availability table and the
-- availability_mode column).

create or replace function public.set_my_availability_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode not in ('AVAILABLE_NOW', 'UNAVAILABLE', 'SCHEDULE', 'PAUSED') then
    raise exception 'INVALID_MODE';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'provider') then
    raise exception 'NOT_A_PROVIDER' using errcode = '42501';
  end if;

  update public.profiles set availability_mode = p_mode where id = v_uid;

  -- Only worth re-matching when the provider just became eligible again.
  if p_mode in ('AVAILABLE_NOW', 'SCHEDULE') then
    perform public.sync_provider_opportunities(v_uid);
  end if;

  return p_mode;
end;
$$;

-- p_slots: [{ "dayOfWeek": 0-6, "startTime": "08:00", "endTime": "18:00" }, ...]
create or replace function public.replace_my_weekly_availability(p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slot jsonb;
  v_start time;
  v_end time;
  v_day int;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'provider') then
    raise exception 'NOT_A_PROVIDER' using errcode = '42501';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'INVALID_SLOTS';
  end if;
  if jsonb_array_length(p_slots) > 28 then
    raise exception 'TOO_MANY_SLOTS';
  end if;

  -- Validate everything before touching the existing hours.
  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_day := (v_slot ->> 'dayOfWeek')::int;
    v_start := (v_slot ->> 'startTime')::time;
    v_end := (v_slot ->> 'endTime')::time;
    if v_day is null or v_day not between 0 and 6 or v_start is null or v_end is null or v_end <= v_start then
      raise exception 'INVALID_SLOTS';
    end if;
  end loop;

  delete from public.provider_availability where provider_id = v_uid;

  insert into public.provider_availability (provider_id, day_of_week, start_time, end_time)
  select
    v_uid,
    (s ->> 'dayOfWeek')::smallint,
    (s ->> 'startTime')::time,
    (s ->> 'endTime')::time
  from jsonb_array_elements(p_slots) s
  on conflict (provider_id, day_of_week, start_time, end_time) do nothing;

  -- Setting hours puts the provider on their schedule.
  perform public.set_my_availability_mode('SCHEDULE');
end;
$$;

revoke all on function public.set_my_availability_mode(text) from public, anon;
revoke all on function public.replace_my_weekly_availability(jsonb) from public, anon;
grant execute on function public.set_my_availability_mode(text) to authenticated;
grant execute on function public.replace_my_weekly_availability(jsonb) to authenticated;
