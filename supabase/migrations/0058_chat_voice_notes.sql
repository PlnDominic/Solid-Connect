-- Migration 0058: Chat voice notes
-- Adds audio attachment fields to chat_messages and provisions the chat-audio storage bucket.

-- 1. Add audio fields to chat_messages
alter table public.chat_messages
  add column if not exists audio_url text;

alter table public.chat_messages
  add column if not exists audio_duration_seconds integer;

-- 2. Update content constraint to allow voice notes (text, image, or audio)
alter table public.chat_messages
  drop constraint if exists chat_messages_has_content;

do $$ begin
  alter table public.chat_messages
    add constraint chat_messages_has_content check (
      text is not null or image_url is not null or audio_url is not null
    );
exception when duplicate_object then null; end $$;

-- 3. Provision storage bucket for chat audio files
insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', true)
on conflict (id) do nothing;

do $$ begin
  create policy "chat participants upload their own chat audio" on storage.objects for insert
    with check (
      bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "anyone can read chat audio" on storage.objects for select
    using (bucket_id = 'chat-audio');
exception when duplicate_object then null; end $$;
