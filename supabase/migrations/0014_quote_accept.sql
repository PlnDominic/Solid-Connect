-- Phase E: quote revisions + atomic accept → job.

alter table public.quotes
  add column if not exists note text not null default '';

alter table public.quotes
  add column if not exists revision integer not null default 1;

alter table public.quotes
  add column if not exists updated_at timestamptz not null default now();

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
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'QUOTE_NOT_FOUND';
  end if;
  if q.status <> 'sent' then
    raise exception 'QUOTE_NOT_OPEN';
  end if;

  select * into r from public.service_requests where id = q.request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.customer_id <> p_customer_id then
    raise exception 'NOT_REQUEST_OWNER';
  end if;
  if r.status not in ('matching', 'quoted', 'open') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  -- Idempotent if already accepted this quote and job exists
  if exists (
    select 1 from public.jobs j2 where j2.quote_id = q.id
  ) then
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
  if title = '' then
    title := r.category_label;
  end if;

  insert into public.jobs (
    request_id, quote_id, customer_id, provider_id, title, price, location_label, step, status
  ) values (
    r.id, q.id, r.customer_id, q.provider_id, title, q.price, r.location_label, 3, 'in_progress'
  )
  returning * into j;

  insert into public.payments (job_id, amount, status)
  values (j.id, q.price, 'pending');

  insert into public.chat_threads (request_id, provider_id, customer_id, job_id)
  values (r.id, q.provider_id, r.customer_id, j.id)
  on conflict (request_id, provider_id) do update
    set job_id = excluded.job_id;

  select * into q from public.quotes where id = p_quote_id;
  return jsonb_build_object('job', to_jsonb(j), 'quote', to_jsonb(q));
end;
$$;

grant execute on function public.accept_quote to service_role, authenticated;
