create or replace function public.accept_quote_checked(
  p_quote_id uuid,
  p_expected_price integer,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_quote public.quotes%rowtype;
  existing_job public.jobs%rowtype;
begin
  select quote.* into selected_quote
  from public.quotes quote
  join public.service_requests request on request.id = quote.request_id
  where quote.id = p_quote_id and request.customer_id = auth.uid()
  for update of quote;

  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if selected_quote.price is distinct from p_expected_price
     or coalesce(selected_quote.revision, 1) is distinct from p_expected_revision then
    raise exception 'QUOTE_CHANGED';
  end if;
  if selected_quote.status = 'accepted' then
    select * into existing_job from public.jobs
    where quote_id = selected_quote.id and customer_id = auth.uid();
    if found then
      return jsonb_build_object('job', to_jsonb(existing_job), 'quote', to_jsonb(selected_quote));
    end if;
  end if;

  return public.accept_quote(p_quote_id, auth.uid());
end;
$$;

revoke all on function public.accept_quote_checked(uuid, integer, integer) from public, anon;
grant execute on function public.accept_quote_checked(uuid, integer, integer) to authenticated;

create or replace function public.send_job_post_request(
  p_attempt_id uuid,
  p_post_id uuid,
  p_interest_id uuid,
  p_category_id text,
  p_description text,
  p_budget integer,
  p_location_label text,
  p_photos text[],
  p_preferred_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  customer uuid := auth.uid();
  post public.job_posts%rowtype;
  interest public.job_post_interests%rowtype;
  request public.service_requests%rowtype;
  category_label text;
begin
  if customer is null or not exists (
    select 1 from public.profiles where id = customer and role = 'customer' and suspended_at is null
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into post
  from public.job_posts
  where id = p_post_id and customer_id = customer
  for update;
  if not found then raise exception 'POST_HIRE_UNAVAILABLE'; end if;

  select * into interest
  from public.job_post_interests
  where id = p_interest_id and post_id = post.id
  for update;
  if not found or interest.provider_id = customer then raise exception 'POST_HIRE_UNAVAILABLE'; end if;

  select * into request
  from public.service_requests
  where id = p_attempt_id and customer_id = customer
    and preferred_provider_id = interest.provider_id
    and id = post.hire_request_id;
  if found then return to_jsonb(request); end if;

  if post.status <> 'open' or post.expires_at <= now()
     or interest.status not in ('pending', 'shortlisted')
     or public.is_blocked_between(customer, interest.provider_id)
     or not exists (
       select 1 from public.profiles
       where id = interest.provider_id and role = 'provider' and suspended_at is null
         and coalesce(availability_mode::text, '') not in ('UNAVAILABLE', 'PAUSED')
     ) then
    raise exception 'POST_HIRE_UNAVAILABLE';
  end if;

  select default_label into category_label from public.categories where id = p_category_id and active;
  if not found then raise exception 'CATEGORY_ARCHIVED'; end if;
  if p_budget is null or p_budget < 1 or p_budget > 1000000
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 1500
     or char_length(btrim(coalesce(p_location_label, ''))) not between 2 and 200
     or coalesce(cardinality(p_photos), 0) > 4 then
    raise exception 'INVALID_REQUEST_DETAILS';
  end if;
  if p_preferred_time <= now() then raise exception 'SLOT_EXPIRED'; end if;

  insert into public.service_requests (
    id, customer_id, category_id, category_label, description, photos,
    customer_budget, budget_min, budget_max, location_label, preferred_provider_id,
    preferred_time, urgency, request_mode, status, matched_at
  ) values (
    p_attempt_id, customer, p_category_id, category_label, btrim(p_description), coalesce(p_photos, '{}'),
    p_budget, p_budget, p_budget, btrim(p_location_label), interest.provider_id,
    p_preferred_time, case
      when p_preferred_time is not null then 'scheduled'
      when post.start_preference = 'asap' then 'urgent'
      when post.start_preference = 'this_week' then 'soon'
      else 'flexible'
    end,
    'DIRECT', 'awaiting_provider', now()
  ) returning * into request;

  insert into public.request_opportunities (request_id, provider_id, score, status)
  values (request.id, interest.provider_id, 100, 'NOTIFIED');

  update public.job_post_interests set status = 'hired' where id = interest.id;
  update public.job_posts
  set status = 'hired', hired_provider_id = interest.provider_id, hire_request_id = request.id
  where id = post.id;

  return to_jsonb(request);
end;
$$;

revoke all on function public.send_job_post_request(uuid, uuid, uuid, text, text, integer, text, text[], timestamptz) from public, anon;
grant execute on function public.send_job_post_request(uuid, uuid, uuid, text, text, integer, text, text[], timestamptz) to authenticated;
