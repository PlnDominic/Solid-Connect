-- Read-only. Paste into Supabase Dashboard > SQL Editor and Run.
-- Shows whether the latest database changes are on this project. It checks one
-- or two markers per migration, not every statement in it.

select '0088 hardening (subscription switch)' as change,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'platform_config'
                 and column_name = 'subscription_required') as applied
union all
select '0089 private media (apply only after the new app and admin are live)',
       to_regprocedure('public.my_suspension()') is not null
union all
select '0090 chat on job posts',
       to_regprocedure('public.open_job_post_thread(uuid,uuid)') is not null
union all
select '0092 notifications sent by the database',
       to_regprocedure('public.drain_push_outbox()') is not null
union all
select '0093 minimum app version',
       to_regprocedure('public.min_app_version()') is not null
union all
select '0091 accept quotes',
       to_regprocedure('public.accept_quote_checked(uuid,integer,integer)') is not null
union all
select '0091 hire from a job post',
       to_regprocedure('public.send_job_post_request(uuid,uuid,uuid,text,text,integer,text,text[],timestamptz)') is not null
order by change;

-- To see the subscription switch, run this after 0088 shows true.
-- It should say false until the payment server and Hubtel work.
-- select subscription_required from public.platform_config where id = true;
