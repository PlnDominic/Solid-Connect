-- Solid Connect - items 11 and 12 from the "20 more things" list.
--
-- 11. Chat richness: read receipts and image attachments (typing
--     indicators are deliberately NOT a schema change - they're ephemeral
--     by nature, so the mobile client uses a Supabase Realtime broadcast
--     channel for those, not a persisted column here).
-- 12. Cancelling a request before a provider is matched to it.

-- ── 11a. Read receipts ──────────────────────────────────────────────────
alter table public.chat_messages
  add column if not exists read_at timestamptz;

-- ── 11b. Image attachments ──────────────────────────────────────────────
-- A message can now be image-only (no caption) - text becomes optional,
-- guarded by a check that at least one of text/image_url is present so a
-- genuinely empty row can't be inserted.
alter table public.chat_messages
  add column if not exists image_url text;

alter table public.chat_messages
  alter column text drop not null;

do $$ begin
  alter table public.chat_messages
    add constraint chat_messages_has_content check (text is not null or image_url is not null);
exception when duplicate_object then null; end $$;

-- No UPDATE policy exists on chat_messages at all today (only select/
-- insert), so marking messages read needs a security-definer path rather
-- than a new blanket RLS policy - this only ever touches read_at, on
-- messages sent by the *other* participant, in a thread the caller is
-- actually part of.
create or replace function public.mark_thread_read(p_thread_id uuid, p_reader_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_reader_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.chat_messages
  set read_at = now()
  where thread_id = p_thread_id
    and sender_id <> p_reader_id
    and read_at is null
    and exists (
      select 1 from public.chat_threads t
      where t.id = p_thread_id and (t.customer_id = p_reader_id or t.provider_id = p_reader_id)
    );
end;
$$;

revoke all on function public.mark_thread_read(uuid, uuid) from public;
grant execute on function public.mark_thread_read(uuid, uuid) to service_role, authenticated;

-- Same shape as request-photos (0010_request_photos.sql): a public bucket,
-- upload restricted to the caller's own folder. Chat photo URLs are
-- unguessable UUIDs, same trust model already accepted for request and
-- profile photos in this codebase - not introducing a stricter
-- signed-URL scheme here just for this one bucket.
insert into storage.buckets (id, name, public) values ('chat-photos', 'chat-photos', true)
on conflict (id) do nothing;

do $$ begin
  create policy "chat participants upload their own chat photos" on storage.objects for insert
    with check (bucket_id = 'chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "chat photos are publicly readable" on storage.objects for select
    using (bucket_id = 'chat-photos');
exception when duplicate_object then null; end $$;

-- ── 12. Cancelling a request before it's matched to a job ───────────────
-- Cancellable up through 'quoted'/'awaiting_provider' - anything short of
-- an actual job existing (status 'accepted' onward). Clears standing
-- opportunities so it stops appearing in any provider's feed immediately,
-- and notifies anyone already engaged with it (a quote already sent, or a
-- DIRECT request already waiting on one specific provider) rather than
-- leaving them to find out when their quote/accept silently goes nowhere.
create or replace function public.cancel_request(p_request_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.service_requests%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into r from public.service_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.customer_id <> p_customer_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if r.status not in ('open', 'matching', 'quoted', 'awaiting_provider') then
    raise exception 'REQUEST_NOT_CANCELLABLE';
  end if;

  update public.service_requests set status = 'cancelled' where id = p_request_id;
  delete from public.request_opportunities where request_id = p_request_id;

  insert into public.notifications (user_id, type, title, body, data)
  select provider_id, 'REQUEST_CANCELLED', 'Request cancelled', 'The customer cancelled this request before it was matched.', jsonb_build_object('requestId', p_request_id)
  from public.quotes where request_id = p_request_id
  union
  select r.preferred_provider_id, 'REQUEST_CANCELLED', 'Request cancelled', 'The customer cancelled this request before it was matched.', jsonb_build_object('requestId', p_request_id)
  where r.preferred_provider_id is not null;
end;
$$;

revoke all on function public.cancel_request(uuid, uuid) from public;
grant execute on function public.cancel_request(uuid, uuid) to service_role, authenticated;
