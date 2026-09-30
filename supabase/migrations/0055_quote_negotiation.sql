-- Richer, negotiable quotes.
--   A. New columns: line items, proposed start, counter-offer, decline reason.
--   B. Line items must add up to the price.
--   C. Close a hole: customers could UPDATE any column of a quote on their
--      own request (including price, which accept_quote turns into the job's
--      price). They now go through the functions below instead.
--   D. revise_quote / counter_quote / respond_to_counter / decline_quote,
--      each notifying the other side (QUOTE_* types map to the "new quotes"
--      notification preference).

-- ── A. Columns ───────────────────────────────────────────────────────────
alter table public.quotes
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists proposed_start timestamptz,
  add column if not exists counter_price integer,
  add column if not exists counter_note text,
  add column if not exists counter_at timestamptz,
  add column if not exists counter_declined_at timestamptz,
  add column if not exists decline_reason text;

-- ── B. Items add up ──────────────────────────────────────────────────────
-- items: [{"label": "Labour", "amount": 300}, ...] - optional, max 8.
create or replace function public.check_quote_items()
returns trigger
language plpgsql
as $$
declare
  v_count int;
  v_sum bigint;
begin
  if jsonb_typeof(new.items) is distinct from 'array' then
    raise exception 'ITEMS_INVALID';
  end if;
  v_count := jsonb_array_length(new.items);
  if v_count = 0 then
    return new;
  end if;
  if v_count > 8 then raise exception 'ITEMS_INVALID'; end if;

  if exists (
    select 1 from jsonb_array_elements(new.items) e
    where jsonb_typeof(e -> 'amount') is distinct from 'number'
       or (e ->> 'amount')::numeric <= 0
       or (e ->> 'amount')::numeric <> trunc((e ->> 'amount')::numeric)
       or btrim(coalesce(e ->> 'label', '')) = ''
       or char_length(e ->> 'label') > 60
  ) then
    raise exception 'ITEMS_INVALID';
  end if;

  select sum((e ->> 'amount')::numeric)::bigint into v_sum from jsonb_array_elements(new.items) e;
  if v_sum <> new.price then raise exception 'ITEMS_MISMATCH'; end if;
  return new;
end;
$$;

drop trigger if exists quotes_check_items on public.quotes;
create trigger quotes_check_items
  before insert or update of items, price on public.quotes
  for each row execute function public.check_quote_items();

-- ── C. Close the customer UPDATE hole ────────────────────────────────────
drop policy if exists "customers accept/decline quotes on their own requests" on public.quotes;

-- ── D. Functions ─────────────────────────────────────────────────────────
create or replace function public.revise_quote(
  p_quote_id uuid,
  p_price integer,
  p_items jsonb,
  p_note text,
  p_proposed_start timestamptz,
  p_eta_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if auth.uid() is distinct from q.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if p_price is null or p_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  select * into r from public.service_requests where id = q.request_id;
  if r.status not in ('matching', 'quoted', 'open', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_ACCEPTABLE';
  end if;

  update public.quotes
  set price = p_price,
      items = coalesce(p_items, '[]'::jsonb),
      note = coalesce(p_note, ''),
      proposed_start = p_proposed_start,
      eta_label = coalesce(nullif(btrim(p_eta_label), ''), eta_label),
      revision = revision + 1,
      counter_price = null,
      counter_note = null,
      counter_at = null,
      counter_declined_at = null,
      updated_at = now()
  where id = q.id
  returning * into q;

  insert into public.notifications (user_id, type, title, body, data)
  values (r.customer_id, 'QUOTE_REVISED', 'A provider updated their quote',
          'Open your request to see the new price.',
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

create or replace function public.counter_quote(
  p_quote_id uuid,
  p_price integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into r from public.service_requests where id = q.request_id;
  if auth.uid() is distinct from r.customer_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if q.counter_price is not null then raise exception 'COUNTER_PENDING'; end if;
  if q.counter_declined_at is not null then raise exception 'COUNTER_DECLINED'; end if;
  -- Lower than the quote, and not an insulting lowball.
  if p_price is null or p_price >= q.price or p_price < ceil(q.price * 0.5) then
    raise exception 'INVALID_COUNTER';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'NOTE_TOO_LONG'; end if;

  update public.quotes
  set counter_price = p_price,
      counter_note = nullif(btrim(coalesce(p_note, '')), ''),
      counter_at = now(),
      updated_at = now()
  where id = q.id
  returning * into q;

  insert into public.notifications (user_id, type, title, body, data)
  values (q.provider_id, 'QUOTE_COUNTER', 'A customer made a counter-offer',
          'They offered GHS ' || p_price || '. Accept, decline or send a new price.',
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

create or replace function public.respond_to_counter(
  p_quote_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if auth.uid() is distinct from q.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;
  if q.counter_price is null then raise exception 'NO_COUNTER'; end if;
  select * into r from public.service_requests where id = q.request_id;

  if p_accept then
    -- The old breakdown no longer adds up; the provider can add a new one
    -- by revising the quote.
    update public.quotes
    set price = q.counter_price,
        items = '[]'::jsonb,
        revision = revision + 1,
        counter_price = null,
        counter_note = null,
        counter_at = null,
        counter_declined_at = null,
        updated_at = now()
    where id = q.id
    returning * into q;

    insert into public.notifications (user_id, type, title, body, data)
    values (r.customer_id, 'QUOTE_COUNTER_ACCEPTED', 'Your counter-offer was accepted',
            'The quote is now GHS ' || q.price || '. You can accept it to book the job.',
            jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));
  else
    update public.quotes
    set counter_price = null,
        counter_note = null,
        counter_declined_at = now(),
        updated_at = now()
    where id = q.id
    returning * into q;

    insert into public.notifications (user_id, type, title, body, data)
    values (r.customer_id, 'QUOTE_COUNTER_DECLINED', 'Your counter-offer was declined',
            'The original quote still stands.',
            jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));
  end if;

  return to_jsonb(q);
end;
$$;

create or replace function public.decline_quote(
  p_quote_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  r public.service_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  select * into r from public.service_requests where id = q.request_id for update;
  if auth.uid() is distinct from r.customer_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if q.status <> 'sent' then raise exception 'QUOTE_NOT_OPEN'; end if;

  update public.quotes
  set status = 'declined',
      decline_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
      counter_price = null,
      counter_note = null,
      counter_at = null,
      updated_at = now()
  where id = q.id
  returning * into q;

  -- Declined the last open quote: the request goes back to collecting
  -- quotes instead of sitting in "quoted" with nothing to show.
  if r.status = 'quoted'
     and not exists (select 1 from public.quotes where request_id = r.id and status = 'sent') then
    update public.service_requests set status = 'matching' where id = r.id;
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (q.provider_id, 'QUOTE_DECLINED', 'A customer declined your quote',
          coalesce(q.decline_reason, 'They chose not to go ahead with this quote.'),
          jsonb_build_object('requestId', q.request_id, 'quoteId', q.id));

  return to_jsonb(q);
end;
$$;

revoke all on function public.revise_quote(uuid, integer, jsonb, text, timestamptz, text) from public, anon;
revoke all on function public.counter_quote(uuid, integer, text) from public, anon;
revoke all on function public.respond_to_counter(uuid, boolean) from public, anon;
revoke all on function public.decline_quote(uuid, text) from public, anon;
grant execute on function public.revise_quote(uuid, integer, jsonb, text, timestamptz, text) to authenticated;
grant execute on function public.counter_quote(uuid, integer, text) to authenticated;
grant execute on function public.respond_to_counter(uuid, boolean) to authenticated;
grant execute on function public.decline_quote(uuid, text) to authenticated;
