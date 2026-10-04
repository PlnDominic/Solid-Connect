-- Mark a request 'quoted' when a provider quotes on it, in the database.
--
-- Until now the quoting provider's own app flipped service_requests.status
-- to 'quoted' right after inserting the quote. RLS only lets a customer
-- update their own request, so that update silently changed nothing: the
-- request stayed 'open' / 'matching' and the customer's Activity tab kept
-- showing "finding providers" with quotes waiting unseen. This trigger
-- does it server-side, whoever inserts the quote (app, Nest API, admin).

create or replace function public.mark_request_quoted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'sent' then
    update public.service_requests
    set status = 'quoted'
    where id = new.request_id
      and status in ('open', 'matching');
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_mark_request_quoted on public.quotes;
create trigger quotes_mark_request_quoted
  after insert on public.quotes
  for each row execute function public.mark_request_quoted();

-- Backfill: requests already holding a sent quote but stuck before 'quoted'.
update public.service_requests r
set status = 'quoted'
where r.status in ('open', 'matching')
  and exists (
    select 1 from public.quotes q
    where q.request_id = r.id and q.status = 'sent'
  );
