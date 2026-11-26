-- Lets old app versions be told to update. Empty (the default) asks nobody.
-- To require 1.1.0 or newer, only after that version is in the stores:
--   update public.platform_config set min_app_version = '1.1.0' where id = true;
-- To stop asking:
--   update public.platform_config set min_app_version = null where id = true;

alter table public.platform_config
  add column if not exists min_app_version text
    check (min_app_version ~ '^[0-9]+(\.[0-9]+){0,2}$');

-- platform_config is admin-only (0027); the app, signed in or not, may read
-- just this one value.
create or replace function public.min_app_version()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select min_app_version from public.platform_config where id = true;
$$;

revoke all on function public.min_app_version() from public;
grant execute on function public.min_app_version() to anon, authenticated, service_role;
