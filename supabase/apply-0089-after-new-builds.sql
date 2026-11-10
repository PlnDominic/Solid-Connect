-- Solid Connect: migration 0089, in one paste. DO NOT RUN YET.
--
-- Run this only AFTER the new app build (from this commit onward) and the new admin site
-- are live. Installed builds from before that read chat and request photos by their public
-- link and read the suspension reason at sign-in; both stop working the moment this runs.
--
-- Paste into Supabase Dashboard > SQL Editor > New query, then Run. One transaction; safe to re-run.
-- Needs supabase/apply-0082-0088.sql applied first.

-- ===== 0089_private_media_and_suspension_columns.sql =====
-- Private chat and request media, and hidden suspension details.
--
-- !! APPLY THIS ONLY AFTER THE NEW APP BUILD AND THE NEW ADMIN SITE ARE LIVE !!
--
-- Builds out today read these photos and voice notes by their public URL and
-- read profiles.suspended_reason in the profile query. Both stop working the
-- moment this runs. The new builds fetch short-lived signed links instead
-- (src/lib/storageUrls.ts) and read the suspension reason through
-- my_suspension(); the new admin site signs its own links and reads reasons
-- with its server key. Signed links also work while the buckets are still
-- public, so ship the builds first, then run this.
--
--   1. chat-photos, chat-audio and request-photos become private. Who can read:
--        chat media  - the sender, the person they are chatting with, admins
--        request photos - the customer, anyone who can see that request, anyone
--                         who can see that customer's open job post, admins
--   2. suspended_reason and suspended_by are no longer readable by the public.
--
-- profile-photos and portfolio-photos stay public on purpose.

-- 1. Buckets -----------------------------------------------------------------------

update storage.buckets set public = false
  where id in ('chat-photos', 'chat-audio', 'request-photos');

drop policy if exists "chat photos are publicly readable" on storage.objects;
drop policy if exists "anyone can read chat audio" on storage.objects;
drop policy if exists "request photos are publicly readable" on storage.objects;

drop policy if exists "chat participants read chat media" on storage.objects;
create policy "chat participants read chat media" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('chat-photos', 'chat-audio')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.chat_threads t
        where (t.customer_id = auth.uid() and t.provider_id::text = (storage.foldername(name))[1])
           or (t.provider_id = auth.uid() and t.customer_id::text = (storage.foldername(name))[1])
      )
    )
  );

drop policy if exists "people involved read request photos" on storage.objects;
create policy "people involved read request photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.service_requests r
        where r.customer_id::text = (storage.foldername(name))[1]
          and public.can_view_request(r.id)
      )
      or exists (
        select 1 from public.job_posts jp
        where jp.customer_id::text = (storage.foldername(name))[1]
          and (jp.status = 'open' or public.has_job_post_interest(jp.id))
      )
    )
  );

-- 2. Suspension details --------------------------------------------------------------

revoke select (suspended_reason, suspended_by) on public.profiles from anon, authenticated;

-- A suspended person (and nobody else) can read their own reason.
create or replace function public.my_suspension()
returns table (suspended_at timestamptz, suspended_reason text)
language sql
stable
security definer
set search_path = public
as $$
  select p.suspended_at, p.suspended_reason
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_suspension() from public, anon;
grant execute on function public.my_suspension() to authenticated;
