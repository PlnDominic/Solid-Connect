-- 0090: chat before hire on a job post.
--
-- Until now a chat thread only existed once a customer had a request with a
-- provider, so a customer could not ask an interested provider a question
-- before hiring them. This lets either side of a job-post interest open a
-- thread. Phone numbers and account details stay blocked in chat (0071), so
-- talking early does not move the deal off the platform.

alter table public.chat_threads
  add column if not exists job_post_id uuid references public.job_posts(id) on delete cascade;

create unique index if not exists chat_threads_job_post_provider_uniq
  on public.chat_threads (job_post_id, provider_id)
  where job_post_id is not null;

-- Opens (or returns) the thread for one interest on one post. Allowed for the
-- post's customer and for the provider who expressed the interest, and only
-- while that interest is live (not declined). SECURITY DEFINER because the
-- provider side has no insert policy on chat_threads.
create or replace function public.open_job_post_thread(p_post_id uuid, p_provider_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_customer uuid;
  v_status text;
  v_thread uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to send a message.' using errcode = '42501';
  end if;

  select customer_id into v_customer from public.job_posts where id = p_post_id;
  if v_customer is null then
    raise exception 'That job post no longer exists.' using errcode = 'P0002';
  end if;

  if auth.uid() <> v_customer and auth.uid() <> p_provider_id then
    raise exception 'You are not part of this job post.' using errcode = '42501';
  end if;

  select status into v_status
    from public.job_post_interests
    where post_id = p_post_id and provider_id = p_provider_id;
  if v_status is null or v_status = 'declined' then
    raise exception 'This provider is not on the post.' using errcode = '42501';
  end if;

  select id into v_thread
    from public.chat_threads
    where job_post_id = p_post_id and provider_id = p_provider_id;
  if v_thread is null then
    insert into public.chat_threads (job_post_id, customer_id, provider_id)
    values (p_post_id, v_customer, p_provider_id)
    returning id into v_thread;
  end if;
  return v_thread;
end;
$$;

revoke all on function public.open_job_post_thread(uuid, uuid) from public, anon;
grant execute on function public.open_job_post_thread(uuid, uuid) to authenticated;
