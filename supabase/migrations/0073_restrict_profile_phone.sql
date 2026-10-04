-- Phone numbers are no longer readable by every signed-in user.
--
-- profiles is publicly readable (0001), phone included, so anyone could
-- look up anyone's number through the API - around the chat rules that
-- block sharing contact details (0071/0072) and the chat call button that
-- now only appears once a job is booked. From here:
--   * app users (anon, authenticated) can read every profiles column
--     EXCEPT phone;
--   * contact_phone(user) returns a number only to that person
--     themself, to an admin, or to someone with an active job with them
--     (accepted, in progress, awaiting sign-off);
--   * phone_in_use(phone) answers sign-up's "is this number taken?"
--     without exposing whose it is.
-- Writes are unchanged: people still set their own phone as before.
-- The service role (admin server actions, Nest API) keeps full access.
--
-- NOTE for future migrations: a column added to profiles is NOT readable
-- by the app until it is granted, e.g.
--   grant select (new_column) on public.profiles to anon, authenticated;

revoke select on public.profiles from anon, authenticated;

do $$
declare
  col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name <> 'phone'
  loop
    execute format('grant select (%I) on public.profiles to anon, authenticated', col);
  end loop;
end;
$$;

create or replace function public.contact_phone(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.phone
  from public.profiles p
  where p.id = p_user_id
    and auth.uid() is not null
    and (
      p.id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.jobs j
        where j.status in ('accepted', 'in_progress', 'awaiting_completion_confirmation')
          and (
            (j.customer_id = auth.uid() and j.provider_id = p.id)
            or (j.provider_id = auth.uid() and j.customer_id = p.id)
          )
      )
    );
$$;

revoke all on function public.contact_phone(uuid) from public, anon;
grant execute on function public.contact_phone(uuid) to authenticated;

create or replace function public.phone_in_use(p_phone text, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where phone = p_phone
      and (p_exclude is null or id <> p_exclude)
  );
$$;

revoke all on function public.phone_in_use(text, uuid) from public;
grant execute on function public.phone_in_use(text, uuid) to anon, authenticated;

-- ── admin dashboard: phones for admins only ───────────────────────────
-- The admin site reads profiles as the signed-in admin, so it needs the
-- same narrow door: these return nothing unless the caller is an admin.

create or replace function public.admin_profile_phones(p_ids uuid[])
returns table (id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.phone
  from public.profiles p
  where public.is_admin() and p.id = any(p_ids);
$$;

create or replace function public.admin_profile_ids_by_phone(p_term text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where public.is_admin()
    and length(regexp_replace(coalesce(p_term, ''), '\D', '', 'g')) >= 3
    and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
        like '%' || regexp_replace(p_term, '\D', '', 'g') || '%'
  limit 200;
$$;

revoke all on function public.admin_profile_phones(uuid[]) from public, anon;
grant execute on function public.admin_profile_phones(uuid[]) to authenticated;
revoke all on function public.admin_profile_ids_by_phone(text) from public, anon;
grant execute on function public.admin_profile_ids_by_phone(text) to authenticated;
