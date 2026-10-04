-- Email addresses and push tokens are no longer readable by every
-- signed-in user. Same approach as phone (0073) and payout_account (0075):
-- app users lose SELECT on the columns, and narrow functions answer only
-- what each screen needs:
--   * my_private_profile()      - your own phone, email and push token;
--   * email_in_use(email)       - sign-up's "already registered?" check;
--   * profile_id_by_email(email)- adding an organization member by email;
--   * admin_profile_contacts(ids), admin_profile_ids_by_contact(term)
--                               - the admin dashboard (admins only).
-- Writes are unchanged. The service role (admin server actions, Nest API)
-- keeps full access. Requires 0073.

revoke select (email, push_token) on public.profiles from anon, authenticated;

create or replace function public.my_private_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('phone', p.phone, 'email', p.email, 'push_token', p.push_token)
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;

create or replace function public.email_in_use(p_email text, p_exclude uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where lower(email) = lower(trim(p_email))
      and (p_exclude is null or id <> p_exclude)
  );
$$;

revoke all on function public.email_in_use(text, uuid) from public;
grant execute on function public.email_in_use(text, uuid) to anon, authenticated;

create or replace function public.profile_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where auth.uid() is not null
    and lower(p.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.profile_id_by_email(text) from public, anon;
grant execute on function public.profile_id_by_email(text) to authenticated;

-- ── admin dashboard ───────────────────────────────────────────────────
create or replace function public.admin_profile_contacts(p_ids uuid[])
returns table (id uuid, phone text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.phone, p.email
  from public.profiles p
  where public.is_admin() and p.id = any(p_ids);
$$;

-- Ids whose email contains the term, or whose phone contains its digits.
create or replace function public.admin_profile_ids_by_contact(p_term text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where public.is_admin()
    and length(trim(coalesce(p_term, ''))) >= 2
    and (
      p.email ilike '%' || trim(p_term) || '%'
      or (
        length(regexp_replace(p_term, '\D', '', 'g')) >= 3
        and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
            like '%' || regexp_replace(p_term, '\D', '', 'g') || '%'
      )
    )
  limit 500;
$$;

revoke all on function public.admin_profile_contacts(uuid[]) from public, anon;
grant execute on function public.admin_profile_contacts(uuid[]) to authenticated;
revoke all on function public.admin_profile_ids_by_contact(text) from public, anon;
grant execute on function public.admin_profile_ids_by_contact(text) to authenticated;
