begin;

do $$
declare
  customer_id uuid := gen_random_uuid();
  other_customer_id uuid := gen_random_uuid();
  provider_id uuid := gen_random_uuid();
  category_id text := gen_random_uuid()::text;
  request_id uuid;
  quote_id uuid;
  post_id uuid;
  interest_id uuid;
  attempt_id uuid := gen_random_uuid();
  first_result jsonb;
  retry_result jsonb;
begin
  insert into public.profiles (id, role, full_name, initials)
  values (customer_id, 'customer', 'Booking test customer', 'BC'),
         (other_customer_id, 'customer', 'Booking test visitor', 'BV'),
         (provider_id, 'provider', 'Booking test provider', 'BP');
  insert into public.categories (id, name, abbr, default_label)
  values (category_id, 'Booking test service', 'BT', 'Booking test service');
  insert into public.service_requests (customer_id, category_label, description, location_label)
  values (customer_id, 'Booking test service', 'Please repair the leaking sink.', 'Osu, Accra')
  returning id into request_id;
  insert into public.quotes (request_id, provider_id, price)
  values (request_id, provider_id, 175)
  returning id into quote_id;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', other_customer_id::text, true);
  begin
    perform public.accept_quote_checked(quote_id, 175, 1);
    raise exception 'Expected a non-owner to be denied';
  exception when raise_exception then
    if sqlerrm <> 'QUOTE_NOT_FOUND' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  begin
    perform public.accept_quote_checked(quote_id, 150, 1);
    raise exception 'Expected a changed price to be denied';
  exception when raise_exception then
    if sqlerrm <> 'QUOTE_CHANGED' then raise; end if;
  end;
  begin
    perform public.accept_quote_checked(quote_id, 175, 2);
    raise exception 'Expected a changed revision to be denied';
  exception when raise_exception then
    if sqlerrm <> 'QUOTE_CHANGED' then raise; end if;
  end;

  first_result := public.accept_quote_checked(quote_id, 175, 1);
  retry_result := public.accept_quote_checked(quote_id, 175, 1);
  if (first_result #>> '{job,price}')::integer is distinct from 175
     or first_result #>> '{job,id}' is null
     or first_result #>> '{job,id}' is distinct from retry_result #>> '{job,id}' then
    raise exception 'Expected one job at the confirmed price';
  end if;

  insert into public.job_posts (customer_id, category_label, title, description, location_label, start_preference)
  values (customer_id, 'Booking test service', 'Fix a leak', 'The sink leaks when I turn it on.', 'Osu, Accra', 'this_week')
  returning id into post_id;
  perform set_config('request.jwt.claim.sub', provider_id::text, true);
  insert into public.job_post_interests (post_id, provider_id, proposed_price)
  values (post_id, provider_id, 175)
  returning id into interest_id;

  perform set_config('request.jwt.claim.sub', customer_id::text, true);
  begin
    perform public.send_job_post_request(attempt_id, post_id, interest_id, category_id,
      'The sink leaks when I turn it on.', 175, 'Osu, Accra', '{}', now() - interval '1 hour');
    raise exception 'Expected the expired appointment to be rejected';
  exception when raise_exception then
    if sqlerrm <> 'SLOT_EXPIRED' then raise; end if;
  end;
  if not exists (select 1 from public.job_posts post where post.id = post_id and post.status = 'open')
     or not exists (select 1 from public.job_post_interests interest where interest.id = interest_id and interest.status = 'pending')
     or exists (select 1 from public.service_requests request where request.id = attempt_id) then
    raise exception 'An invalid booking changed the listing or created a request';
  end if;

  first_result := public.send_job_post_request(attempt_id, post_id, interest_id, category_id,
    'The sink leaks when I turn it on.', 175, 'Osu, Accra', '{}', null);
  retry_result := public.send_job_post_request(attempt_id, post_id, interest_id, category_id,
    'The sink leaks when I turn it on.', 175, 'Osu, Accra', '{}', null);
  if first_result is distinct from retry_result
     or first_result->>'id' is distinct from attempt_id::text
     or first_result->>'urgency' is distinct from 'soon'
     or not exists (select 1 from public.job_posts post where post.id = post_id and post.hire_request_id = attempt_id and post.status = 'hired')
     or not exists (select 1 from public.job_post_interests interest where interest.id = interest_id and interest.status = 'hired')
     or not exists (select 1 from public.request_opportunities opportunity where opportunity.request_id = attempt_id and opportunity.status = 'NOTIFIED') then
    raise exception 'Expected a single linked request and a closed public listing';
  end if;
end;
$$;

rollback;
