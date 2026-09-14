-- "Delete chat" from the chat list. A thread row is shared by both
-- participants (customer_id + provider_id on the same row), so a hard
-- delete would erase the whole conversation - including the other
-- person's copy of it - the moment either side tapped delete. That's
-- not what "delete this chat" means in any chat app people actually use
-- (WhatsApp, iMessage, etc. all remove it from your own list only), so
-- this is a per-participant hide instead: each side gets its own
-- "hidden_at" column, set only on their own side, and the thread simply
-- stops appearing in useThreadsForRole() for whichever side hid it. The
-- row and every message in it are untouched - the other participant's
-- conversation is exactly as it was, and if a new message arrives the
-- thread will naturally need to reappear for whoever hid it (handled in
-- application code, not here).

alter table public.chat_threads
  add column if not exists customer_hidden_at timestamptz,
  add column if not exists provider_hidden_at timestamptz;

-- Row-level RLS still only checks that the caller is a participant on
-- this thread (same shape as the existing select policy) - it trusts the
-- client to only ever set its own side's column, same trust level the
-- rest of this schema's policies already place in the app's own code
-- rather than enforcing column-level restrictions with a trigger.
create policy "participants hide their own side of a thread"
  on public.chat_threads for update
  using (auth.uid() = customer_id or auth.uid() = provider_id)
  with check (auth.uid() = customer_id or auth.uid() = provider_id);
