-- Security fix: several SECURITY DEFINER RPCs trusted a caller-supplied
-- "actor id" parameter (p_customer_id / p_provider_id) instead of tying the
-- action to the caller's own auth.uid(). Because these RPCs are called
-- directly by the mobile client via supabase-js (not only through the
-- trusted Nest API), any authenticated user could pass someone else's id
-- and act on their behalf — e.g. confirm a job they don't own and release
-- its escrowed payment, or overwrite another provider's categories/areas.
--
-- The Nest API always calls these RPCs with the service_role key and an
-- actor id it already derived from a verified JWT (see
-- api/src/auth/guards/supabase-jwt.guard.ts), so service_role calls are
-- left untouched; only calls made as the `authenticated` role are now
-- required to act as themselves.

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

  insert into public.payments (job_id, amount, status)
  values (j.id, q.price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_customer_id, 'CREATED', 0, 1, 'Job created — waiting for provider to start');

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
  values (j.id, price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, p_provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'CREATED', 0, 1, 'Direct job created — start work when ready');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    r.customer_id,
    'DIRECT_ACCEPTED',
    'Provider accepted your request',
    'Your job is set up at GHS ' || price::text || '. Waiting for the provider to start.',
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
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

create or replace function public.start_job(
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
  if j.status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;
  if j.status = 'awaiting_completion_confirmation' then raise exception 'JOB_AWAITING_CUSTOMER'; end if;
  if j.status = 'in_progress' then
    return to_jsonb(j);
  end if;
  if j.status <> 'accepted' then raise exception 'JOB_NOT_STARTABLE'; end if;

  update public.jobs
  set
    status = 'in_progress',
    step = greatest(step, 2),
    started_at = coalesce(started_at, now())
  where id = j.id
  returning * into j;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'STARTED', 1, j.step, 'Provider started work');

  return to_jsonb(j);
end;
$$;

create or replace function public.finish_job(
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
  if j.status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;
  if j.status = 'awaiting_completion_confirmation' then
    return to_jsonb(j);
  end if;
  if j.status <> 'in_progress' then raise exception 'JOB_NOT_IN_PROGRESS'; end if;

  update public.jobs
  set
    status = 'awaiting_completion_confirmation',
    step = 5,
    provider_completed_at = now()
  where id = j.id
  returning * into j;

  insert into public.job_events (job_id, actor_id, event_type, from_step, to_step, note)
  values (j.id, p_provider_id, 'FINISHED', 2, 5, 'Provider finished work — awaiting customer confirmation');

  insert into public.notifications (user_id, type, title, body, data)
  values (
    j.customer_id,
    'JOB_AWAITING_CONFIRMATION',
    'Confirm job completion',
    'Your provider marked the job finished. Confirm to release payment.',
    jsonb_build_object('jobId', j.id, 'providerId', p_provider_id)
  );

  return to_jsonb(j);
end;
$$;

-- Keep advance_job as a thin alias: start if accepted, else finish if in_progress.
-- start_job/finish_job already re-check the caller, but guarding here too
-- gives a clear FORBIDDEN instead of surfacing whichever inner error fires.
create or replace function public.advance_job(
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

  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'JOB_NOT_FOUND'; end if;
  if j.status = 'accepted' then
    return public.start_job(p_job_id, p_provider_id);
  end if;
  if j.status = 'in_progress' then
    return public.finish_job(p_job_id, p_provider_id);
  end if;
  if j.status = 'awaiting_completion_confirmation' then
    raise exception 'JOB_AWAITING_CUSTOMER';
  end if;
  if j.status = 'completed' then
    raise exception 'JOB_ALREADY_COMPLETED';
  end if;
  raise exception 'JOB_NOT_ADVANCEABLE';
end;
$$;

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

  update public.payments
  set status = 'released', released_at = coalesce(released_at, now())
  where job_id = j.id and status = 'pending'
  returning * into p;

  if p.id is null then
    select * into p from public.payments where job_id = j.id limit 1;
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

create or replace function public.replace_provider_service_areas(
  p_provider_id uuid,
  p_areas jsonb
)
returns setof public.provider_service_areas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item jsonb;
  new_center geography;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.provider_service_areas where provider_id = p_provider_id;

  for item in select * from jsonb_array_elements(coalesce(p_areas, '[]'::jsonb))
  loop
    if upper(item->>'type') = 'CITY' then
      if coalesce(item->>'cityName', '') = '' then
        raise exception 'cityName is required for CITY areas';
      end if;
      insert into public.provider_service_areas (provider_id, type, city_name)
      values (p_provider_id, 'CITY', item->>'cityName');
    elsif upper(item->>'type') = 'RADIUS' then
      new_center := ST_SetSRID(
        ST_MakePoint((item->>'lng')::double precision, (item->>'lat')::double precision),
        4326
      )::geography;
      insert into public.provider_service_areas (provider_id, type, center, radius_meters)
      values (p_provider_id, 'RADIUS', new_center, (item->>'radiusMeters')::integer);
    else
      raise exception 'Invalid service area type: %', item->>'type';
    end if;
  end loop;

  -- Prefer first RADIUS for profile.location; else first CITY centroid
  update public.profiles p
  set location = sa.center
  from (
    select center from public.provider_service_areas
    where provider_id = p_provider_id and type = 'RADIUS'
    order by created_at asc
    limit 1
  ) sa
  where p.id = p_provider_id and sa.center is not null;

  update public.profiles p
  set location = ac.location
  from public.provider_service_areas sa
  join public.area_centroids ac on ac.name = sa.city_name
  where p.id = p_provider_id
    and p.location is null
    and sa.provider_id = p_provider_id
    and sa.type = 'CITY';

  return query
    select * from public.provider_service_areas where provider_id = p_provider_id;
end;
$$;

create or replace function public.replace_provider_categories(
  p_provider_id uuid,
  p_category_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ids text[];
  primary_id text;
  label text;
  skill_ids uuid[];
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  ids := array(
    select distinct x
    from unnest(coalesce(p_category_ids, '{}'::text[])) as x
    where x is not null and trim(x) <> ''
  );
  if coalesce(array_length(ids, 1), 0) < 1 then
    raise exception 'CATEGORIES_REQUIRED';
  end if;

  if exists (
    select 1 from unnest(ids) as cid
    where not exists (select 1 from public.categories c where c.id = cid)
  ) then
    raise exception 'UNKNOWN_CATEGORY';
  end if;

  delete from public.provider_categories where provider_id = p_provider_id;

  primary_id := ids[1];
  insert into public.provider_categories (provider_id, category_id, is_primary)
  select p_provider_id, cid, (cid = primary_id)
  from unnest(ids) as cid;

  select string_agg(c.name, ' · ' order by array_position(ids, c.id))
  into label
  from public.categories c
  where c.id = any (ids);

  update public.profiles
  set provider_category = label
  where id = p_provider_id;

  -- Replace skills with the General skill for each selected category.
  select coalesce(array_agg(s.id), '{}'::uuid[])
  into skill_ids
  from public.skills s
  where s.category_id = any (ids);

  delete from public.provider_skills
  where provider_id = p_provider_id
    and skill_id not in (select unnest(skill_ids));

  insert into public.provider_skills (provider_id, skill_id, years_experience, verification_status, updated_at)
  select p_provider_id, sid, 0, 'UNVERIFIED', now()
  from unnest(skill_ids) as sid
  on conflict (provider_id, skill_id) do update
    set updated_at = now();

  return jsonb_build_object(
    'categoryIds', to_jsonb(ids),
    'label', label,
    'skillCount', coalesce(array_length(skill_ids, 1), 0)
  );
end;
$$;

create or replace function public.sync_provider_opportunities(p_provider_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  m record;
  n integer := 0;
begin
  if p_provider_id is null then
    return 0;
  end if;

  if auth.role() <> 'service_role' and auth.uid() is distinct from p_provider_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  for r in
    select sr.id
    from public.service_requests sr
    where sr.status in ('open', 'matching', 'quoted')
      and coalesce(sr.request_mode, 'GENERAL') <> 'DIRECT'
      and sr.preferred_provider_id is null
      and exists (
        select 1
        from public.provider_categories pc
        left join public.categories c on c.id = pc.category_id
        where pc.provider_id = p_provider_id
          and (
            pc.category_id = sr.category_id
            or (
              c.name is not null
              and lower(coalesce(sr.category_label, '')) like '%' || lower(c.name) || '%'
            )
          )
      )
  loop
    select mp.provider_id, mp.score, mp.distance_meters
      into m
    from public.match_providers_for_request(r.id, 50) mp
    where mp.provider_id = p_provider_id
    limit 1;

    if found then
      insert into public.request_opportunities (
        request_id, provider_id, score, distance_meters, status
      )
      values (
        r.id, m.provider_id, m.score, m.distance_meters, 'NOTIFIED'
      )
      on conflict (request_id, provider_id) do update
        set score = excluded.score,
            distance_meters = excluded.distance_meters
      where request_opportunities.status <> 'DISMISSED';
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

-- match_providers_for_request returns matched-provider ids/scores for an
-- arbitrary request_id with no ownership check, which would otherwise let
-- any authenticated user read another customer's match list — data that
-- request_opportunities' own RLS policy is meant to keep private to that
-- request's customer/provider/admin. It's a plain `language sql` function
-- (used internally by sync_provider_opportunities and by the trusted Nest
-- API), so rather than bolting a procedural check onto it, just stop
-- letting end users call it directly; the backend keeps using it via
-- service_role, and sync_provider_opportunities keeps using it as the
-- SECURITY DEFINER function owner.
revoke execute on function public.match_providers_for_request(uuid, integer) from authenticated;
grant execute on function public.match_providers_for_request(uuid, integer) to service_role;

grant execute on function public.accept_quote to service_role, authenticated;
grant execute on function public.accept_direct_request to service_role, authenticated;
grant execute on function public.reject_direct_request to service_role, authenticated;
grant execute on function public.start_job to service_role, authenticated;
grant execute on function public.finish_job to service_role, authenticated;
grant execute on function public.advance_job to service_role, authenticated;
grant execute on function public.confirm_job_completion to service_role, authenticated;
grant execute on function public.replace_provider_service_areas to service_role, authenticated;
grant execute on function public.replace_provider_categories to service_role, authenticated;
grant execute on function public.sync_provider_opportunities(uuid) to service_role, authenticated;
