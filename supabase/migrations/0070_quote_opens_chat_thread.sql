-- Every quote opens a chat between that provider and the customer.
--
-- A chat thread used to exist only once the customer tapped "Chat" on a
-- quote or accepted one - and providers can't create threads at all (RLS
-- only lets the customer insert). So most provider/customer pairs talking
-- about a request had no chat on either side's Chats list. Now a thread is
-- created, server-side, the moment a provider quotes, and it is the same
-- one accept_quote() later attaches the job to (unique on request_id,
-- provider_id).

create or replace function public.open_thread_for_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_threads (request_id, provider_id, customer_id)
  select r.id, new.provider_id, r.customer_id
  from public.service_requests r
  where r.id = new.request_id
  on conflict (request_id, provider_id) do nothing;
  return new;
end;
$$;

drop trigger if exists quotes_open_chat_thread on public.quotes;
create trigger quotes_open_chat_thread
  after insert on public.quotes
  for each row execute function public.open_thread_for_quote();

-- Backfill: a thread for every quote that doesn't have one yet.
insert into public.chat_threads (request_id, provider_id, customer_id)
select distinct q.request_id, q.provider_id, r.customer_id
from public.quotes q
join public.service_requests r on r.id = q.request_id
on conflict (request_id, provider_id) do nothing;
